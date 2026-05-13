export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserProfileResponse {
  email: string;
  name: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error: string | null;
  statusCode: string;
}

export interface AuthData {
  token: string;
  user: UserProfileResponse;
}

export type LoginResponse = ApiResponse<AuthData>;

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface DeployResponse {
  previewUrl: string;
}

export interface ChatHistoryMessage {
  id: number;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

export enum ChatEventType {
  THOUGHT = 'THOUGHT',
  MESSAGE = 'MESSAGE',
  FILE_EDIT = 'FILE_EDIT',
  TOOL_CALL = 'TOOL_CALL'
}

export interface ChatEvent {
  id?: number;
  type: ChatEventType;
  content: string; // Markdown, Code, or Tool Summary
  metadata?: string; // Tool args (e.g. "src/App.tsx")
  filePath?: string; // For FILE_EDIT
  sequenceOrder?: number;
}

export interface ChatMessage {
  id: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content?: string; // Fallback raw text
  events: ChatEvent[]; // The granular events
  createdAt?: string;
}

export interface ProjectSummaryResponse {
  projectId: number;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  role?: ProjectRole;
}

export interface ProjectResponse {
  projectId: number;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  role?: ProjectRole;
}

export interface ProjectDto {
  projectName: string;
  isPublic: boolean;
  projectRole?: ProjectRole;
}

export interface ProjectRequest {
  name: string;
}

export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface ProjectMember {
  userId: number;
  email: string;
  name?: string;
  role: ProjectRole;
}

export interface InviteMemberRequest {
  email: string;
  role: ProjectRole;
}

export interface SignupRequest {
  email: string;
  name: string;
  password: string;
}

export type AuthResponse = ApiResponse<AuthData>;