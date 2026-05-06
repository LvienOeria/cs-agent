export interface ToolCallRecord {
  toolName: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

export interface RoundMetrics {
  round: number;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  toolCalls: ToolCallRecord[];
}

export class RequestTracker {
  readonly requestId: string;
  readonly startTime: number;
  private rounds: RoundMetrics[] = [];

  constructor(requestId: string) {
    this.requestId = requestId;
    this.startTime = Date.now();
  }

  addRound(metrics: RoundMetrics): void {
    this.rounds.push(metrics);
  }

  get lastRound(): RoundMetrics | undefined {
    return this.rounds[this.rounds.length - 1];
  }

  get allRounds(): RoundMetrics[] {
    return this.rounds;
  }

  summary() {
    const totalDurationMs = Date.now() - this.startTime;
    const totalPromptTokens = this.rounds.reduce((sum, r) => sum + r.promptTokens, 0);
    const totalCompletionTokens = this.rounds.reduce((sum, r) => sum + r.completionTokens, 0);
    const totalToolCalls = this.rounds.reduce((sum, r) => sum + r.toolCalls.length, 0);

    return {
      requestId: this.requestId,
      rounds: this.rounds.length,
      totalDurationMs,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      totalToolCalls,
      roundsDetail: this.rounds,
    };
  }
}
