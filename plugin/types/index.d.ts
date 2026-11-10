export type RecPhase = 'starting' | 'waiting' | 'recording' | 'processing' | 'ready' | 'error'

export type Rec = {
  phase: RecPhase
  message: string
  startedAt: number
  recordUrl?: string
  pollUrl?: string
  videoUrl?: string
  changes?: number
  prompt?: string
  isFilled?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    tellscreen: { rec: Rec | null; hidden: boolean }
  }
}
