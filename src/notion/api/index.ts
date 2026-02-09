// Barrel export for the Notion API layer.
//
// IMPORTANT: esbuild IIFE bundling with the SKILL_HEADER `var exports = {}`
// breaks inter-module imports.  `import * as pages from './pages'` resolves
// to an empty object at runtime because tsc CJS output writes to the global
// `exports` shim rather than to esbuild's per-module export objects.
//
// Workaround: we still import the modules (to trigger their initialization),
// but build the notionApi object by reading functions from globalThis.exports
// where the CJS modules actually placed them.
//
// The NotionApi interface is defined explicitly so TypeScript consumers
// get proper return types (the runtime object is cast to this interface).
import type {
  AppendBlockChildrenResponse,
  CreateCommentResponse,
  CreateDatabaseResponse,
  CreatePageResponse,
  DeleteBlockResponse,
  GetBlockResponse,
  GetDatabaseResponse,
  GetDataSourceResponse,
  GetPageResponse,
  GetUserResponse,
  ListBlockChildrenResponse,
  ListCommentsResponse,
  ListUsersResponse,
  QueryDataSourceResponse,
  SearchResponse,
  UpdateBlockResponse,
  UpdateDatabaseResponse,
  UpdatePageResponse,
} from '@notionhq/client/build/src/api-endpoints';

// Side-effect imports — trigger module initialization
import { getDatabase, resolveDataSourceId, getDataSource, queryDataSource, createDatabase, updateDatabase, listAllDatabases } from './databases';
import { getPage, createPage, updatePage, archivePage, getPageContent } from './pages';
import { getBlock, getBlockChildren, appendBlockChildren, updateBlock, deleteBlock } from './blocks';
import { getUser, listUsers } from './users';
import { createComment, listComments } from './comments';
import { search } from './search';

export interface NotionApi {
  // pages
  getPage(pageId: string): GetPageResponse;
  createPage(body: Record<string, unknown>): CreatePageResponse;
  updatePage(pageId: string, body: Record<string, unknown>): UpdatePageResponse;
  archivePage(pageId: string): UpdatePageResponse;
  getPageContent(pageId: string, pageSize?: number): ListBlockChildrenResponse;
  // databases
  getDatabase(databaseId: string): GetDatabaseResponse;
  resolveDataSourceId(databaseId: string): string;
  getDataSource(dataSourceId: string): GetDataSourceResponse;
  queryDataSource(databaseId: string, body?: Record<string, unknown>): QueryDataSourceResponse;
  createDatabase(body: Record<string, unknown>): CreateDatabaseResponse;
  updateDatabase(databaseId: string, body: Record<string, unknown>): UpdateDatabaseResponse;
  listAllDatabases(pageSize?: number): SearchResponse;
  // blocks
  getBlock(blockId: string): GetBlockResponse;
  getBlockChildren(blockId: string, pageSize?: number): ListBlockChildrenResponse;
  appendBlockChildren(blockId: string, children: unknown[]): AppendBlockChildrenResponse;
  updateBlock(blockId: string, body: Record<string, unknown>): UpdateBlockResponse;
  deleteBlock(blockId: string): DeleteBlockResponse;
  // users
  getUser(userId: string): GetUserResponse;
  listUsers(pageSize?: number, startCursor?: string): ListUsersResponse;
  // comments
  createComment(body: Record<string, unknown>): CreateCommentResponse;
  listComments(blockId: string, pageSize?: number): ListCommentsResponse;
  // search
  search(body: Record<string, unknown>): SearchResponse;
}

// After all modules initialize, their exported functions live on
// globalThis.exports (the SKILL_HEADER's `var exports = {}`).
const _e = (globalThis as unknown as { exports: Record<string, unknown> }).exports;

export const notionApi: NotionApi = {
  // pages
  getPage: getPage,
  createPage: createPage,
  updatePage: updatePage,
  archivePage: archivePage,
  getPageContent: getPageContent,
  // databases
  getDatabase: getDatabase,
  resolveDataSourceId: resolveDataSourceId,
  getDataSource: getDataSource,
  queryDataSource: queryDataSource,
  createDatabase: createDatabase,
  updateDatabase: updateDatabase,
  listAllDatabases: listAllDatabases,
  // blocks
  getBlock: getBlock,
  getBlockChildren: getBlockChildren,
  appendBlockChildren: appendBlockChildren,
  updateBlock: updateBlock,
  deleteBlock: deleteBlock,
  // users
  getUser: getUser,
  listUsers: listUsers,
  // comments
  createComment: createComment,
  listComments: listComments,
  // search
  search: search,
} as NotionApi;
