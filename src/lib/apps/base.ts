export interface AppConnector {
  id: string;
  name: string;
  connect(userId: string): Promise<void>;
  disconnect(userId: string): Promise<void>;
  getCapabilities(): string[];
  /**
   * Return a user-facing string if the connector handled the request.
   * Return null to signal "not applicable" so the AI can answer normally.
   */
  handleIntent(input: string, userId: string): Promise<string | null>;
}


