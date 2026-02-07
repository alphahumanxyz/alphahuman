// Tool: notion-summarize-pages
// Triggers AI summarization of synced pages and returns results
import '../skill-state';

export const summarizePagesTool: ToolDefinition = {
  name: 'notion-summarize-pages',
  description:
    'Run AI summarization on synced Notion pages that have content but no summary (or stale summaries). ' +
    'Requires a local model to be available. Returns count of pages summarized.',
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description:
          'Maximum number of pages to summarize in this batch. Defaults to the configured maxPagesPerContentSync.',
      },
    },
  },
  execute(args: Record<string, unknown>): string {
    try {
      if (!oauth.getCredential()) {
        return JSON.stringify({
          success: false,
          error: 'Notion not connected. Complete OAuth setup first.',
        });
      }

      if (!model.isAvailable()) {
        return JSON.stringify({
          success: false,
          error: 'AI model not available. Ensure a local model is downloaded and loaded.',
          model_status: model.getStatus(),
        });
      }

      const s = globalThis.getNotionSkillState();
      const batchLimit =
        typeof args.limit === 'number' && args.limit > 0
          ? args.limit
          : s.config.maxPagesPerContentSync;

      const getPagesNeedingSummary = (globalThis as Record<string, unknown>)
        .getPagesNeedingSummary as
        | ((
            limit: number
          ) => Array<{
            id: string;
            title: string;
            content_text: string;
            url: string | null;
            last_edited_time: string;
            created_time: string;
          }>)
        | undefined;
      const updatePageAiSummary = (globalThis as Record<string, unknown>).updatePageAiSummary as
        | ((pageId: string, summary: string, category?: string, sentiment?: string) => void)
        | undefined;
      const inferCategoryAndSentiment = (globalThis as Record<string, unknown>)
        .inferCategoryAndSentiment as
        | ((text: string) => { category: string; sentiment: string })
        | undefined;

      if (!getPagesNeedingSummary || !updatePageAiSummary) {
        return JSON.stringify({ success: false, error: 'Database helpers not available.' });
      }

      const pages = getPagesNeedingSummary(batchLimit);

      if (pages.length === 0) {
        return JSON.stringify({
          success: true,
          message: 'All pages are already summarized.',
          summarized: 0,
          failed: 0,
        });
      }

      let summarized = 0;
      let failed = 0;
      const errors: string[] = [];

      let titleOnly = 0;

      for (const page of pages) {
        try {
          const trimmed = page.content_text.trim();
          const hasContent = trimmed.length >= 50;

          // Infer category and sentiment from title (and content snippet if available)
          const classifyInput = hasContent
            ? `Title: ${page.title}\nContent: ${trimmed.substring(0, 500)}`
            : `Title: ${page.title}`;
          const classified = inferCategoryAndSentiment
            ? inferCategoryAndSentiment(classifyInput)
            : { category: 'other', sentiment: 'neutral' };

          let summary: string;

          if (!hasContent) {
            // No meaningful content: use title as summary
            summary = page.title;
            titleOnly++;
          } else {
            // Build prompt with metadata context
            const metaParts: string[] = [`Title: ${page.title}`];
            if (page.url) metaParts.push(`URL: ${page.url}`);
            metaParts.push(`Created: ${page.created_time}`);
            metaParts.push(`Last edited: ${page.last_edited_time}`);
            const metaBlock = metaParts.join('\n');

            const summarizeFn = (globalThis as Record<string, unknown>)
              .summarizeWithFallback as
              | ((content: string, metaBlock: string) => string | null)
              | undefined;
            const result = summarizeFn
              ? summarizeFn(trimmed, metaBlock)
              : null;
            if (!result) continue;
            summary = result;
          }

          // Store summary, category, and sentiment in local DB
          updatePageAiSummary(page.id, summary, classified.category, classified.sentiment);

          // Submit to server via socket
          model.submitSummary({
            summary,
            category: classified.category,
            dataSource: 'notion',
            sentiment: classified.sentiment as 'positive' | 'neutral' | 'negative' | 'mixed',
            metadata: {
              pageId: page.id,
              pageTitle: page.title,
              pageUrl: page.url,
              lastEditedTime: page.last_edited_time,
              createdTime: page.created_time,
              contentLength: trimmed.length,
              noContent: !hasContent,
            },
          });

          summarized++;
        } catch (e) {
          failed++;
          errors.push(`${page.title}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return JSON.stringify({
        success: true,
        summarized,
        failed,
        title_only: titleOnly,
        total_candidates: pages.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
