import { useEffect, useRef, useState } from 'react'
import {
  Copy,
  CopyPlus,
  Download,
  FileCode,
  FilePlus2,
  History as HistoryIcon,
  Pencil,
  RotateCcw,
  Share2,
  Star,
  Trash2,
  X
} from 'lucide-react'
import type { Asset, AssetFile, AssetInput } from '@shared/types'
import { assetToText } from '@shared/assetFormat'
import { useStore } from '../store'
import { formatDate } from '../selectors'
import { toast } from './Toast'

export function AssetEditor(): React.JSX.Element {
  const asset = useStore((s) => s.assets.find((a) => a.id === s.selectedAssetId) ?? null)

  if (!asset) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas text-faint">
        <FileCode size={40} className="mb-3 opacity-40" />
        <p className="font-serif text-base">选择左侧资产，或新建一个开始</p>
      </div>
    )
  }
  return <Editor key={asset.id} asset={asset} />
}

function Editor({ asset }: { asset: Asset }): React.JSX.Element {
  const categories = useStore((s) => s.categories)
  const updateAsset = useStore((s) => s.updateAsset)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const duplicateAsset = useStore((s) => s.duplicateAsset)
  const toggleAssetFavorite = useStore((s) => s.toggleAssetFavorite)
  const restoreAssetVersion = useStore((s) => s.restoreAssetVersion)
  const exportAsset = useStore((s) => s.exportAsset)
  const installAsset = useStore((s) => s.installAsset)
  const mergeMcp = useStore((s) => s.mergeMcp)

  const [tab, setTab] = useState<'edit' | 'history'>('edit')
  const [menuOpen, setMenuOpen] = useState(false)
  const [name, setName] = useState(asset.name)
  const [description, setDescription] = useState(asset.description ?? '')
  const [content, setContent] = useState(asset.content)
  const [tagDraft, setTagDraft] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Partial<AssetInput>>({})

  function commit() {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (Object.keys(pending.current).length > 0) {
      const patch = pending.current
      pending.current = {}
      void updateAsset(asset.id, patch)
    }
  }
  function schedule(patch: Partial<AssetInput>) {
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(commit, 500)
  }
  function flush(patch: Partial<AssetInput>) {
    pending.current = { ...pending.current, ...patch }
    commit()
  }
  // Flush pending edits on unmount (asset switch / workspace change).
  useEffect(() => {
    return () => commit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setMeta(key: string, value: string) {
    flush({ meta: { [key]: value } })
  }

  async function copyFormatted() {
    await navigator.clipboard.writeText(assetToText(asset))
    toast.success('已复制为对应格式')
  }
  async function handleExport() {
    const res = await exportAsset(asset.id)
    if (res.ok) toast.success('已导出到文件')
  }
  async function doInstall(preset?: string) {
    setMenuOpen(false)
    const r = await installAsset(asset.id, preset)
    if (r.ok) toast.success(`已安装到 ${r.path}`)
    else toast.error('安装失败或已取消')
  }
  async function doMerge(preset?: string) {
    setMenuOpen(false)
    const r = await mergeMcp(asset.id, preset)
    if (r.ok) toast.success(`已合并 ${r.server} → ${r.path}`)
    else toast.error('合并失败或已取消')
  }
  function addTag(raw: string) {
    const tag = raw.trim().replace(/^#/, '')
    if (tag && !asset.tags.includes(tag)) flush({ tags: [...asset.tags, tag] })
    setTagDraft('')
  }
  async function handleDelete() {
    const snapshot = asset
    await deleteAsset(asset.id)
    toast.undo(`已删除「${snapshot.name}」`, () => {
      void useStore.getState().restoreAsset(snapshot)
    })
  }

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      {/* Toolbar */}
      <div className="app-drag app-drag-pad flex items-center gap-2 border-b border-line px-6 py-3.5">
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
          {asset.kind}
        </span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            schedule({ name: e.target.value })
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-lg font-medium text-ink outline-none placeholder:text-faint"
          placeholder="名称"
        />
        <TBtn title="收藏" active={asset.favorite} onClick={() => toggleAssetFavorite(asset.id)}>
          <Star size={17} fill={asset.favorite ? 'currentColor' : 'none'} />
        </TBtn>
        <TBtn title="复制为格式文本" onClick={copyFormatted}>
          <Copy size={17} />
        </TBtn>
        <TBtn title="导出到文件" onClick={handleExport}>
          <Download size={17} />
        </TBtn>
        <TBtn
          title="创建副本"
          onClick={async () => {
            await duplicateAsset(asset.id)
            toast.success('已创建副本')
          }}
        >
          <CopyPlus size={17} />
        </TBtn>

        <div className="relative">
          <TBtn title="分发 / 安装到工具" active={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            <Share2 size={17} />
          </TBtn>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-line-strong bg-surface p-1 shadow-[rgba(0,0,0,0.12)_0px_8px_28px]">
                {asset.kind === 'mcp' ? (
                  <>
                    <MenuItem onClick={() => doMerge('cursor')}>
                      合并到 Cursor<span className="text-faint">~/.cursor/mcp.json</span>
                    </MenuItem>
                    <MenuItem onClick={() => doMerge('windsurf')}>
                      合并到 Windsurf<span className="text-faint">~/.codeium/windsurf/mcp_config.json</span>
                    </MenuItem>
                    <MenuItem onClick={() => doMerge('cline')}>
                      合并到 Cline<span className="text-faint">VS Code 扩展设置</span>
                    </MenuItem>
                    <MenuItem onClick={() => doMerge('vscode-project')}>
                      合并到 VS Code 项目<span className="text-faint">&lt;项目&gt;/.vscode/mcp.json</span>
                    </MenuItem>
                    <MenuItem onClick={() => doMerge('claude-project')}>
                      合并到 Claude Code 项目<span className="text-faint">&lt;项目&gt;/.mcp.json</span>
                    </MenuItem>
                    <MenuItem onClick={() => doMerge()}>选择 mcp.json 合并…</MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem onClick={() => doInstall('claude')}>
                      安装到 Claude（全局）
                      <span className="text-faint">
                        ~/.claude/{asset.kind === 'skill' ? 'skills' : 'agents'}
                      </span>
                    </MenuItem>
                    <MenuItem onClick={() => doInstall('claude-project')}>
                      安装到 Claude 项目
                      <span className="text-faint">
                        &lt;项目&gt;/.claude/{asset.kind === 'skill' ? 'skills' : 'agents'}
                      </span>
                    </MenuItem>
                    <MenuItem onClick={() => doInstall()}>选择目录安装…</MenuItem>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <TBtn title="删除" danger onClick={handleDelete}>
          <Trash2 size={17} />
        </TBtn>
      </div>

      {/* Description + category + tags */}
      <div className="space-y-2 border-b border-line px-6 py-2.5">
        <input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            schedule({ description: e.target.value })
          }}
          placeholder="一句话描述（会写入 description 字段）"
          className="w-full bg-transparent text-xs text-muted outline-none placeholder:text-faint"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={asset.categoryId ?? ''}
            onChange={(e) => flush({ categoryId: e.target.value || null })}
            className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-focus"
          >
            <option value="">未分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {asset.tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
            >
              #{t}
              <button onClick={() => flush({ tags: asset.tags.filter((x) => x !== t) })} className="hover:text-error">
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagDraft)
              }
            }}
            placeholder="添加标签…"
            className="w-24 bg-transparent text-[11px] text-ink outline-none placeholder:text-faint"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-line px-4">
        <AssetTab active={tab === 'edit'} onClick={() => setTab('edit')} icon={<Pencil size={14} />}>
          编辑
        </AssetTab>
        <AssetTab active={tab === 'history'} onClick={() => setTab('history')} icon={<HistoryIcon size={14} />}>
          历史
          {asset.versions.length > 0 && (
            <span className="ml-1 rounded-full bg-surface-2 px-1.5 text-[10px] text-faint">
              {asset.versions.length}
            </span>
          )}
        </AssetTab>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'history' ? (
          <AssetHistory asset={asset} onRestore={restoreAssetVersion} />
        ) : asset.kind === 'mcp' ? (
          <McpFields asset={asset} setMeta={setMeta} />
        ) : (
          <div className="flex h-full flex-col gap-3">
            {asset.kind === 'skill' && (
              <Field label="allowed-tools（可选，逗号分隔）">
                <input
                  value={asset.meta.allowedTools ?? ''}
                  onChange={(e) => setMeta('allowedTools', e.target.value)}
                  placeholder="Read, Grep, Glob"
                  className={fieldCls}
                />
              </Field>
            )}
            {asset.kind === 'agent' && (
              <div className="flex gap-2">
                <Field label="tools（逗号分隔）">
                  <input
                    value={asset.meta.tools ?? ''}
                    onChange={(e) => setMeta('tools', e.target.value)}
                    placeholder="Read, Grep, Bash"
                    className={fieldCls}
                  />
                </Field>
                <Field label="model">
                  <input
                    value={asset.meta.model ?? ''}
                    onChange={(e) => setMeta('model', e.target.value)}
                    placeholder="sonnet / opus / haiku"
                    className={fieldCls}
                  />
                </Field>
              </div>
            )}
            <div className="flex flex-1 flex-col">
              <div className="mb-1 text-xs text-muted">
                {asset.kind === 'skill' ? 'SKILL.md 正文' : '系统提示（System Prompt）'}
              </div>
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  schedule({ content: e.target.value })
                }}
                onBlur={() => flush({ content })}
                spellCheck={false}
                placeholder="使用 Markdown 编写…"
                className="min-h-[200px] flex-1 resize-none rounded-2xl border border-line-strong bg-surface p-5 font-mono text-sm leading-[1.7] text-ink outline-none focus:border-focus"
              />
            </div>
            {asset.kind === 'skill' && (
              <SkillFiles files={asset.files} onChange={(files) => flush({ files })} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SkillFiles({
  files,
  onChange
}: {
  files: AssetFile[]
  onChange(files: AssetFile[]): void
}): React.JSX.Element {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  function update(i: number, patch: Partial<AssetFile>) {
    onChange(files.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  function add() {
    onChange([...files, { path: 'scripts/new-file', content: '' }])
    setOpenIdx(files.length)
  }
  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">附带文件（随 Skill 文件夹一起导出/安装）</span>
        <button
          onClick={add}
          className="flex items-center gap-1 rounded-lg border border-line-strong px-2 py-1 text-xs text-muted transition hover:border-brand hover:text-brand"
        >
          <FilePlus2 size={12} />
          添加文件
        </button>
      </div>
      {files.length === 0 ? (
        <div className="py-3 text-center text-xs text-faint">暂无附带文件</div>
      ) : (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="rounded-lg border border-line-strong">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <input
                  value={f.path}
                  onChange={(e) => update(i, { path: e.target.value })}
                  placeholder="相对路径，如 scripts/run.py"
                  className="flex-1 bg-transparent font-mono text-xs text-ink outline-none"
                />
                <button onClick={() => setOpenIdx(openIdx === i ? null : i)} className="text-xs text-faint hover:text-ink">
                  {openIdx === i ? '收起' : '编辑'}
                </button>
                <button
                  onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                  className="text-faint hover:text-error"
                >
                  <X size={13} />
                </button>
              </div>
              {openIdx === i && (
                <textarea
                  value={f.content}
                  onChange={(e) => update(i, { content: e.target.value })}
                  rows={6}
                  spellCheck={false}
                  placeholder="文件内容…"
                  className="w-full resize-y rounded-b-lg border-t border-line bg-canvas p-3 font-mono text-xs text-ink outline-none"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssetHistory({
  asset,
  onRestore
}: {
  asset: Asset
  onRestore(assetId: string, versionId: string): Promise<void>
}): React.JSX.Element {
  if (asset.versions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-faint">
        暂无历史版本。修改内容或配置后会自动保存上一版本。
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {asset.versions.map((v) => (
        <div key={v.id} className="rounded-xl border border-line-strong bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-ink">{v.name}</span>
            <button
              onClick={async () => {
                await onRestore(asset.id, v.id)
                toast.success('已恢复到该版本')
              }}
              className="flex items-center gap-1 rounded-lg border border-line-strong px-2 py-0.5 text-[11px] text-muted transition hover:border-brand hover:text-brand"
            >
              <RotateCcw size={11} />
              恢复
            </button>
          </div>
          <div className="mt-1 text-[10px] text-faint">{formatDate(v.createdAt)}</div>
          <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap font-mono text-[11px] text-muted">
            {(v.content || Object.entries(v.meta).map(([k, val]) => `${k}: ${val}`).join('\n')).slice(0, 220) || '（空）'}
          </pre>
        </div>
      ))}
    </div>
  )
}

function AssetTab({
  active,
  onClick,
  icon,
  children
}: {
  active: boolean
  onClick(): void
  icon: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition ${
        active
          ? 'border-brand font-medium text-brand'
          : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

const fieldCls =
  'w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-focus'

function McpFields({
  asset,
  setMeta
}: {
  asset: Asset
  setMeta(key: string, value: string): void
}): React.JSX.Element {
  const transport = asset.meta.transport || 'stdio'
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Field label="传输方式">
          <select
            value={transport}
            onChange={(e) => setMeta('transport', e.target.value)}
            className={fieldCls}
          >
            <option value="stdio">stdio（本地命令）</option>
            <option value="sse">SSE（远程）</option>
            <option value="http">HTTP（远程）</option>
          </select>
        </Field>
        <Field label="输出格式（不同工具的 JSON 键名）">
          <select
            value={asset.meta.schemaKey || 'mcpServers'}
            onChange={(e) => setMeta('schemaKey', e.target.value)}
            className={fieldCls}
          >
            <option value="mcpServers">mcpServers（Claude / Cursor）</option>
            <option value="servers">servers（VS Code）</option>
          </select>
        </Field>
      </div>

      {transport === 'stdio' ? (
        <>
          <Field label="command">
            <input
              value={asset.meta.command ?? ''}
              onChange={(e) => setMeta('command', e.target.value)}
              placeholder="npx"
              className={fieldCls}
            />
          </Field>
          <Field label="args（每行一个）">
            <textarea
              rows={4}
              value={asset.meta.args ?? ''}
              onChange={(e) => setMeta('args', e.target.value)}
              placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/path/to/dir'}
              className={`${fieldCls} resize-y font-mono`}
            />
          </Field>
          <Field label="env（每行 KEY=VALUE）">
            <textarea
              rows={2}
              value={asset.meta.env ?? ''}
              onChange={(e) => setMeta('env', e.target.value)}
              placeholder={'API_KEY=xxxx'}
              className={`${fieldCls} resize-y font-mono`}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="url">
            <input
              value={asset.meta.url ?? ''}
              onChange={(e) => setMeta('url', e.target.value)}
              placeholder="https://example.com/mcp"
              className={fieldCls}
            />
          </Field>
          <Field label="headers（每行 KEY=VALUE，可选，用于鉴权）">
            <textarea
              rows={2}
              value={asset.meta.headers ?? ''}
              onChange={(e) => setMeta('headers', e.target.value)}
              placeholder={'Authorization=Bearer xxxx'}
              className={`${fieldCls} resize-y font-mono`}
            />
          </Field>
        </>
      )}

      <div>
        <div className="mb-1 text-xs text-muted">mcp.json 预览</div>
        <pre className="overflow-auto rounded-xl border border-line-strong bg-surface p-3 font-mono text-xs text-ink">
          {assetToText(asset)}
        </pre>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block flex-1">
      <div className="mb-1 text-xs text-muted">{label}</div>
      {children}
    </label>
  )
}

function MenuItem({
  children,
  onClick
}: {
  children: React.ReactNode
  onClick(): void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-surface-2"
    >
      {children}
    </button>
  )
}

function TBtn({
  children,
  title,
  onClick,
  active,
  danger
}: {
  children: React.ReactNode
  title: string
  onClick(): void
  active?: boolean
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-lg p-2 transition ${
        active
          ? 'text-brand'
          : danger
            ? 'text-faint hover:bg-error/10 hover:text-error'
            : 'text-faint hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
