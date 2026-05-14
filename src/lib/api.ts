import {
  ApiResponse,
  AuthResponse,
  ChatEvent,
  ChatEventType,
  ChatMessage,
  DeployResponse,
  FileNode,
  LoginCredentials,
  LoginResponse,
  ProjectDto,
  ProjectMember,
  ProjectResponse,
  ProjectRole,
  ProjectSummaryResponse,
  SignupRequest,
  UserProfileResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://api.sdnapps.site/api/v1";

export const getAuthToken = () => localStorage.getItem("auth_token");

export const setAuthToken = (token: string) => localStorage.setItem("auth_token", token);

export const removeAuthToken = () => localStorage.removeItem("auth_token");

export const isAuthenticated = () => !!getAuthToken();

const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// User info storage
export const setUserInfo = (user: UserProfileResponse) => {
  localStorage.setItem("user_info", JSON.stringify(user));
};

export const getUserInfo = (): UserProfileResponse | null => {
  const userInfo = localStorage.getItem("user_info");
  return userInfo ? JSON.parse(userInfo) : null;
};

export const removeUserInfo = () => localStorage.removeItem("user_info");

// LocalStorage keys
export const PREVIEW_URL_KEY = "preview_url";
export const OPEN_TABS_KEY = "open_tabs";
export const ACTIVE_TAB_KEY = "active_tab";

// API response format for files endpoint
interface FilePathNodeDto {
  path: string;
}

interface FileContentResponse {
  path: string;
  content: string;
}

interface ChatEventResponseDto {
  id?: number;
  eventType?: string;
  sequenceOrder?: number;
  content?: string;
  filePath?: string;
  metadata?: string;
}

interface ChatMessageDto {
  id: number;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content?: string;
  chatEvents?: ChatEventResponseDto[];
  createdAt?: string;
}

const parseErrorText = async (response: Response, fallback: string) => {
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
};

const toProjectRole = (value?: string): ProjectRole => {
  if (value === "OWNER" || value === "EDITOR" || value === "VIEWER") {
    return value;
  }
  return "VIEWER";
};

const toChatEventType = (value?: string): ChatEventType => {
  if (value === "THOUGHT") return ChatEventType.THOUGHT;
  if (value === "FILE_EDIT") return ChatEventType.FILE_EDIT;
  if (value === "TOOL_CALL") return ChatEventType.TOOL_CALL;
  return ChatEventType.MESSAGE;
};

// Convert flat file paths to nested tree structure
function buildFileTree(paths: any): FileNode[] {
  const root: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  // Sort paths to ensure directories come before their children
  const sortedPaths = [...paths.files].sort((a, b) => a.path.localeCompare(b.path));

  for (const { path } of sortedPaths) {
    const parts = path.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // Skip if node already exists
      if (nodeMap.has(currentPath)) continue;

      const isFile = i === parts.length - 1;
      const node: FileNode = {
        name: part,
        path: currentPath,
        type: isFile ? "file" : "directory",
        children: isFile ? undefined : [],
      };

      nodeMap.set(currentPath, node);

      if (parentPath) {
        const parent = nodeMap.get(parentPath);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      } else {
        root.push(node);
      }
    }
  }

  // Sort each level: directories first, then alphabetically
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === "directory" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };

  sortNodes(root);
  return root;
}

export const api = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch(`${BASE_URL}/account/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await parseErrorText(response, "Login failed");
      throw new Error(error || "Login failed");
    }

    return response.json();
  },

  async signup(data: SignupRequest): Promise<AuthResponse> {
    const response = await fetch(`${BASE_URL}/account/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await parseErrorText(response, "Signup failed");
      throw new Error(error || "Signup failed");
    }

    return response.json();
  },

  async getFiles(projectId: string): Promise<FileNode[]> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${projectId}/files`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch files");
    }

    const payload: ApiResponse<FilePathNodeDto[]> = await response.json();

    if (!payload.success) {
      throw new Error(payload.error || "Failed to fetch files");
    }

    return buildFileTree(payload.data || []);
  },

  async getFileContent(projectId: string, path: string): Promise<string> {
    const encodedPath = encodeURIComponent(path);
    const response = await fetch(
      `${BASE_URL}/workspace/projects/${projectId}/files/content?path=${encodedPath}`,
      {
        headers: { ...getAuthHeaders() },
      }
    );

    if (!response.ok) {
      const error = await parseErrorText(response, "Failed to fetch file content");
      throw new Error(error);
    }

    const payload: any = await response.text();

    // if (!payload.success || !payload.data) {
    //   throw new Error(payload.error || "Failed to fetch file content");
    // }

    return payload;
  },

  async deploy(projectId: string): Promise<DeployResponse> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${projectId}/deploy`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Deployment failed");
    }

    return response.json();
  },

  async getProjects(): Promise<ProjectSummaryResponse[]> {
    const response = await fetch(`${BASE_URL}/workspace/projects`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }

    const payload: ApiResponse<ProjectSummaryResponse[]> = await response.json();

    if (!payload.success) {
      throw new Error(payload.error || "Failed to fetch projects");
    }

    return payload.data;
  },

  async createProject(name: string): Promise<ProjectResponse> {
    const response :any= await fetch(`${BASE_URL}/workspace/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error("Failed to create project");
    }

    return response.json().data;
  },

  async getProject(id: string): Promise<ProjectResponse> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${id}`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch project");
    }

    const payload: ApiResponse<ProjectDto> | ProjectDto = await response.json();

    const data = "data" in payload ? payload.data : payload;

    // The GET project endpoint returns ProjectDto (name/isPublic) in this backend contract.
    return {
      projectId: Number(id),
      projectName: data.projectName,
      createdAt: "",
      updatedAt: "",
      role: data.projectRole,
    };
  },

  async getProjectDetails(id: string): Promise<ProjectDto> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${id}`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch project");
    }

    return response.json();
  },

  async updateProject(id: string, name: string): Promise<ProjectResponse> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    });

    const payload: ApiResponse<ProjectResponse> = await response.json();

    if (!payload.success || !payload.data) {
      throw new Error(payload.error || "Failed to update project");
    }

    return payload.data;
  },

  async deleteProject(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to delete project");
    }
  },

  async downloadProjectZip(id: string): Promise<Blob> {
    throw new Error("Project ZIP download endpoint is not available in the current backend API.");
  },

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${projectId}/members`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch project members");
    }

    const members: any = await response.json();
    return members.data.map((member) => ({
      userId: member.userId,
      email: member.email,
      name: member.name,
      role: toProjectRole(member.roleName),
    }));
  },

  async inviteMember(projectId: string, email: string, role: ProjectRole): Promise<void> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to invite member");
    }
  },

  async updateMemberRole(projectId: string, memberId: number, role: ProjectRole): Promise<void> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${projectId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ projectRole: role }),
    });

    if (!response.ok) {
      throw new Error("Failed to update member role");
    }
  },

  async removeMember(projectId: string, memberId: number): Promise<void> {
    const response = await fetch(`${BASE_URL}/workspace/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to remove member");
    }
  },

  async getChatHistory(projectId: string): Promise<ChatMessage[]> {
    const response = await fetch(`${BASE_URL}/intelligence/chat/projects/${projectId}`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch chat history");
    }

    const payload: ApiResponse<ChatMessageDto[]> | ChatMessageDto[] = await response.json();

    const messages = Array.isArray(payload)
      ? payload
      : (() => {
          if (!payload.success) {
            throw new Error(payload.error || "Failed to fetch chat history");
          }
          return payload.data || [];
        })();

    return messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      events: (message.chatEvents || [])
        .slice()
        .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0))
        .map((event): ChatEvent => ({
          id: event.id,
          type: toChatEventType(event.eventType),
          sequenceOrder: event.sequenceOrder,
          content: event.content || "",
          filePath: event.filePath,
          metadata: event.metadata,
        })),
    }));
  },

  async streamChat(
    projectId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onFile: (path: string, content: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ) {
    const controller = new AbortController();
    const emittedFileKeys = new Set<string>();
    let fullContentBuffer = "";

    fetch(`${BASE_URL}/intelligence/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ message, projectId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Chat stream failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();

        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          sseBuffer += chunk;

          // Process line by line to handle SSE format (data: ...)
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

            const dataStr = trimmedLine.slice(5).trim();
            if (!dataStr) continue;

            try {
              let content = "";
              try {
                const parsed = JSON.parse(dataStr);
                if (typeof parsed === "string") {
                  content = parsed;
                } else if (typeof parsed?.text === "string") {
                  content = parsed.text;
                } else if (typeof parsed?.content === "string") {
                  content = parsed.content;
                } else if (typeof parsed?.data === "string") {
                  content = parsed.data;
                }
              } catch {
                content = dataStr;
              }

              if (!content || content === "[DONE]") {
                continue;
              }

              onChunk(content);
              fullContentBuffer += content;

              const fileRegex = /<file\s+path="([^"]+)"\s*>([\s\S]*?)<\/file>/g;
              let fileMatch: RegExpExecArray | null = null;
              while ((fileMatch = fileRegex.exec(fullContentBuffer)) !== null) {
                const filePath = fileMatch[1];
                const fileContent = fileMatch[2];
                const fileKey = `${filePath}:${fileContent.length}`;
                if (!emittedFileKeys.has(fileKey)) {
                  emittedFileKeys.add(fileKey);
                  onFile(filePath, fileContent);
                }
              }

            } catch (e) {
              console.error("Failed to parse SSE JSON:", e);
            }
          }
        }

        onComplete();
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Stream error:", error);
          onError(error);
        }
      });

    return () => controller.abort();
  }

};
