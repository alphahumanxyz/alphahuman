// Barrel export for the Notion API layer.
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

import {
  appendBlockChildren,
  deleteBlock,
  getBlock,
  getBlockChildren,
  updateBlock,
} from './blocks';
import { createComment, listComments } from './comments';
// Side-effect imports — trigger module initialization
import {
  createDatabase,
  getDatabase,
  getDataSource,
  listAllDatabases,
  queryDataSource,
  resolveDataSourceId,
  updateDatabase,
} from './databases';
import { archivePage, createPage, getPage, getPageContent, updatePage } from './pages';
import { search } from './search';
import { getUser, listUsers } from './users';

export interface NotionApi {
  // pages
  getPage(pageId: string): Promise<GetPageResponse>;
  createPage(body: Record<string, unknown>): Promise<CreatePageResponse>;
  updatePage(pageId: string, body: Record<string, unknown>): Promise<UpdatePageResponse>;
  archivePage(pageId: string): Promise<UpdatePageResponse>;
  getPageContent(pageId: string, pageSize?: number): Promise<ListBlockChildrenResponse>;
  // databases
  getDatabase(databaseId: string): Promise<GetDatabaseResponse>;
  resolveDataSourceId(databaseId: string): string;
  getDataSource(dataSourceId: string): Promise<GetDataSourceResponse>;
  queryDataSource(
    databaseId: string,
    body?: Record<string, unknown>
  ): Promise<QueryDataSourceResponse>;
  createDatabase(body: Record<string, unknown>): Promise<CreateDatabaseResponse>;
  updateDatabase(
    databaseId: string,
    body: Record<string, unknown>
  ): Promise<UpdateDatabaseResponse>;
  listAllDatabases(pageSize?: number): Promise<SearchResponse>;
  // blocks
  getBlock(blockId: string): Promise<GetBlockResponse>;
  getBlockChildren(blockId: string, pageSize?: number): Promise<ListBlockChildrenResponse>;
  appendBlockChildren(blockId: string, children: unknown[]): Promise<AppendBlockChildrenResponse>;
  updateBlock(blockId: string, body: Record<string, unknown>): Promise<UpdateBlockResponse>;
  deleteBlock(blockId: string): Promise<DeleteBlockResponse>;
  // users
  getUser(userId: string): Promise<GetUserResponse>;
  listUsers(pageSize?: number, startCursor?: string): Promise<ListUsersResponse>;
  // comments
  createComment(body: Record<string, unknown>): Promise<CreateCommentResponse>;
  listComments(blockId: string, pageSize?: number): Promise<ListCommentsResponse>;
  // search
  search(body: Record<string, unknown>): Promise<SearchResponse>;
}

export const notionApi: NotionApi = {
  // pages
  getPage,
  createPage,
  updatePage,
  archivePage,
  getPageContent,
  // databases
  getDatabase,
  resolveDataSourceId,
  getDataSource,
  queryDataSource,
  createDatabase,
  updateDatabase,
  listAllDatabases,
  // blocks
  getBlock,
  getBlockChildren,
  appendBlockChildren,
  updateBlock,
  deleteBlock,
  // users
  getUser,
  listUsers,
  // comments
  createComment,
  listComments,
  // search
  search,
} as NotionApi;
