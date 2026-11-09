import type { AgentName } from './copy';

export interface Subtask {
  id: string;
  agent: AgentName;
  goal: string;
  deliverable: string;
}

export interface ExpertResult {
  subtaskId: string;
  agent: AgentName;
  goal: string;
  output: string;
  status: 'done' | 'failed';
  error?: string;
}

export interface QcBreakdown {
  facts: number;
  relevance: number;
  structure: number;
  language: number;
}

export interface QcResult {
  score: number;
  verdict: 'pass' | 'fail';
  feedback: string;
  breakdown?: QcBreakdown;
}

export interface QualityOutcome {
  draft: string;
  qcHistory: QcResult[];
  revisions: number;
  final: string;
  finalVerdict?: 'pass' | 'fail' | 'none';
  usage?: { prompt: number; completion: number };
}

export interface HistoryItem {
  task: string;
  final: string;
  score: number;
  revisions: number;
  elapsed: number;
  time: string;
}
