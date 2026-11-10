// Tellscreen for Claude Code: a "Record screen" button above the prompt and a /record command.
// Pressing it opens the Tellscreen recorder in the browser. Talk through what should change and
// press Stop; Tellscreen writes the change list (each change with what was said, where, and a
// screenshot of that moment) and it lands in this prompt box, ready to send.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Rec } from '../types'

const BASE = 'https://tellscreen.com'
const ACTIVE = ['starting', 'waiting', 'recording', 'processing']
const rec = atom({ plugin: 'tellscreen', key: 'rec' } as const, null)
const hidden = atom({ plugin: 'tellscreen', key: 'hidden' } as const, false)

let busy = false

async function openUrl($: EngineInterface, url: string): Promise<boolean> {
  const tries = [['open', url], ['xdg-open', url], ['cmd.exe', '/c', 'start', '', url]]
  for (const argv of tries) {
    try {
      const r = await $.process.run(argv, { timeoutMs: 15000 })
      if (r.exitCode === 0) return true
    } catch {
      // not on this system: try the next opener
    }
  }
  return false
}

/** The Tellscreen app records the whole screen, with drawing; without it, the browser records a tab or window. */
async function openRecorder($: EngineInterface, code: string, url: string): Promise<'app' | 'browser' | null> {
  const link = `tellscreen://r/${code}`
  try {
    const r = await $.process.run(['open', link], { timeoutMs: 10000 })
    if (r.exitCode === 0) return 'app'
  } catch {
    // not macOS
  }
  try {
    const q = await $.process.run(['reg', 'query', 'HKCU\\Software\\Classes\\tellscreen'], { timeoutMs: 10000 })
    if (q.exitCode === 0) {
      await $.process.run(['cmd.exe', '/c', 'start', '', link], { timeoutMs: 10000 })
      return 'app'
    }
  } catch {
    // not Windows
  }
  return (await openUrl($, url)) ? 'browser' : null
}

async function start($: EngineInterface): Promise<string> {
  const cur = await read($, rec)
  if (cur && ACTIVE.includes(cur.phase) && cur.recordUrl) {
    await openUrl($, cur.recordUrl)
    return `The recorder is open at ${cur.recordUrl}`
  }
  const now = Date.now()
  await update($, rec, (): Rec => ({ phase: 'starting', message: 'Opening the recorder', startedAt: now }))
  let r
  try {
    r = await $.http.fetch(`${BASE}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client: 'claude-code' }),
    })
  } catch {
    r = null
  }
  if (!r || !r.ok) {
    const message = `Couldn't reach Tellscreen${r ? ` (${r.status})` : ''}. Try again in a moment.`
    await update($, rec, (): Rec => ({ phase: 'error', message, startedAt: now }))
    return message
  }
  const h = JSON.parse(r.text) as { code: string; recordUrl: string; pollUrl: string }
  const opened = await openRecorder($, h.code, h.recordUrl)
  const message =
    opened === 'app'
      ? 'Recording with the Tellscreen app: talk through what should change, then press Stop (Alt+Shift+R).'
      : opened === 'browser'
        ? 'Record your screen in the browser and talk through what should change, then press Stop.'
        : `Open ${h.recordUrl} to record, then press Stop.`
  await update($, rec, (): Rec => ({ phase: 'waiting', message, startedAt: now, recordUrl: h.recordUrl, pollUrl: h.pollUrl }))
  return message
}

async function fill($: EngineInterface, text: string): Promise<boolean> {
  try {
    const f = await $.prompt.fill({ text, mode: 'replace' })
    return f.isFilled
  } catch {
    return false
  }
}

async function tick($: EngineInterface): Promise<void> {
  if (busy) return
  busy = true
  try {
    const cur = await read($, rec)
    if (!cur || !cur.pollUrl || !['waiting', 'recording', 'processing'].includes(cur.phase)) return
    if (Date.now() - cur.startedAt > 3 * 3600e3) {
      await update($, rec, (c): Rec | null => (c ? { ...c, phase: 'error', message: 'The recording link expired. Press Record screen to start again.' } : c))
      return
    }
    const r = await $.http.fetch(cur.pollUrl)
    if (r.status === 410) {
      await update($, rec, (c): Rec | null => (c ? { ...c, phase: 'error', message: 'The recording link expired. Press Record screen to start again.' } : c))
      return
    }
    if (!r.ok) return
    const st = JSON.parse(r.text) as { state: string; message: string; prompt?: string; changes?: number; videoUrl?: string }
    if (st.state === 'ready' && st.prompt) {
      const isFilled = await fill($, st.prompt)
      const what = st.changes ? `${st.changes} ${st.changes === 1 ? 'change' : 'changes'}` : 'Your recording'
      const message = isFilled ? `${what} in your prompt. Read it over, then press Enter.` : `${what} ready. Press "Put it in the prompt".`
      await update($, rec, (c): Rec | null => (c ? { ...c, phase: 'ready', message, prompt: st.prompt, isFilled, changes: st.changes, videoUrl: st.videoUrl } : c))
      $.ui.toast(message)
      void $.ui.notify(isFilled ? `${what} from your recording is in your Claude Code prompt.` : `${what} from your recording is ready in Claude Code.`, { title: 'Tellscreen' }).catch(() => undefined)
      return
    }
    if (st.state === 'failed') {
      await update($, rec, (c): Rec | null => (c ? { ...c, phase: 'error', message: st.message } : c))
      return
    }
    const phase: Rec['phase'] = st.state === 'recording' ? 'recording' : st.state === 'processing' ? 'processing' : 'waiting'
    if (phase !== cur.phase || st.message !== cur.message) await update($, rec, (c): Rec | null => (c ? { ...c, phase, message: st.message, videoUrl: st.videoUrl ?? c.videoUrl } : c))
  } catch {
    // a dropped poll is retried on the next tick
  } finally {
    busy = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'record',
      description: 'Record your screen with Tellscreen; the change list comes back as your prompt',
    })
    if ((await $.store.get('hidden')) === true) await update($, hidden, () => true)
    // One quiet timer for the session: it only reaches the network while a recording is under way.
    $.clock.every(3000, () => {
      void tick($)
    })
    return next(e)
  })

  on('command.run', { command: 'record' }, async $ => {
    const message = await start($)
    return { text: `Tellscreen: ${message}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const cur = await read($, rec)
    const isHidden = await read($, hidden)
    const { Box, Button, Text } = $.ui.resolve(e)
    const dismiss = () => update($, rec, () => null)

    if (!cur) {
      if (isHidden || e.props.isWorking) return next(e)
      return (
        <Box>
          <Button key="record" label="● Record screen" variant="primary" onPress={() => start($)} />
          <Text dimColor> Show it instead of typing it: the change list comes back here. </Text>
          <Button
            key="hide"
            label="Hide"
            plain
            onPress={async () => {
              await update($, hidden, () => true)
              await $.store.set('hidden', true)
              $.ui.toast('Hidden. /record still opens the recorder.')
            }}
          />
        </Box>
      )
    }

    if (cur.phase === 'ready') {
      return (
        <Box>
          <Text color="green">✓ </Text>
          <Text>{cur.message} </Text>
          {!cur.isFilled && cur.prompt ? (
            <Button
              key="fill"
              label="Put it in the prompt"
              variant="primary"
              onPress={async () => {
                const ok = await fill($, cur.prompt ?? '')
                await update($, rec, (c): Rec | null => (c ? { ...c, isFilled: ok, message: ok ? 'In your prompt. Read it over, then press Enter.' : c.message } : c))
              }}
            />
          ) : null}
          <Button key="done" label="Done" plain onPress={dismiss} />
        </Box>
      )
    }

    if (cur.phase === 'error') {
      return (
        <Box>
          <Text color="red">Tellscreen: {cur.message} </Text>
          <Button key="again" label="Record again" onPress={() => start($)} />
          <Button key="done" label="Dismiss" plain onPress={dismiss} />
        </Box>
      )
    }

    return (
      <Box>
        <Text color="red">● </Text>
        <Text>Tellscreen: {cur.message} </Text>
        {cur.recordUrl && cur.phase === 'waiting' ? (
          <Button key="open" label="Open recorder" onPress={() => openUrl($, cur.recordUrl ?? '')} />
        ) : null}
        <Button key="cancel" label="Cancel" plain onPress={dismiss} />
      </Box>
    )
  })
}
