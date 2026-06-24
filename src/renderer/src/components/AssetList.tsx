import { useDeferredValue, useMemo } from 'react'
import { Plus, Search, Star } from 'lucide-react'
import type { AssetKind } from '@shared/types'
import { useStore } from '../store'
import { filterAssets, relativeTime } from '../selectors'
import { VirtualList } from './VirtualList'
import { toast } from './Toast'
import { useT } from '../i18n'

const KIND_LABEL: Record<AssetKind, string> = { skill: 'Skill', agent: 'Agent', mcp: 'MCP' }

export function AssetList({ kind }: { kind: AssetKind }): React.JSX.Element {
  const t = useT()
  const assets = useStore((s) => s.assets)
  const selectedAssetId = useStore((s) => s.selectedAssetId)
  const search = useStore((s) => s.assetSearch)
  const favOnly = useStore((s) => s.assetFavOnly)
  const categoryId = useStore((s) => s.assetCategoryId)
  const setSearch = useStore((s) => s.setAssetSearch)
  const selectAsset = useStore((s) => s.selectAsset)
  const createAsset = useStore((s) => s.createAsset)
  const toggleAssetFavorite = useStore((s) => s.toggleAssetFavorite)

  const deferredSearch = useDeferredValue(search)
  const filtered = useMemo(
    () => filterAssets(assets, kind, { search: deferredSearch, favOnly, categoryId }),
    [assets, kind, deferredSearch, favOnly, categoryId]
  )

  async function handleNew() {
    await createAsset(kind)
    toast.success(t('已新建 {kind}', { kind: KIND_LABEL[kind] }))
  }

  function preview(content: string, meta: Record<string, string>): string {
    if (kind === 'mcp') {
      return meta.transport === 'stdio'
        ? `${meta.command ?? ''} ${(meta.args ?? '').split('\n').join(' ')}`.trim() || t('未配置')
        : meta.url || t('未配置')
    }
    return content.slice(0, 80) || t('空内容')
  }

  return (
    <section className="flex w-80 shrink-0 flex-col border-r border-line bg-canvas">
      <div className="flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            data-search-input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('搜索 {kind}…', { kind: KIND_LABEL[kind] })}
            className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none focus:border-focus"
          />
        </div>
        <button
          onClick={handleNew}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-[#faf9f5] transition hover:bg-brand-strong"
          title={t('新建 {kind}', { kind: KIND_LABEL[kind] })}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 pb-1 text-[11px] text-faint">{t('{n} 项', { n: filtered.length })}</div>

      {filtered.length === 0 ? (
        <div className="flex-1 px-4 pt-16 text-center text-sm text-faint">
          {t('还没有 {kind}。', { kind: KIND_LABEL[kind] })}
          <br />
          {t('点击')} <span className="text-brand">＋</span> {t('新建，或从文件导入。')}
        </div>
      ) : (
        <VirtualList
          items={filtered}
          rowHeight={84}
          scrollToIndex={filtered.findIndex((a) => a.id === selectedAssetId)}
          className="flex-1 px-2.5 pb-3"
          renderItem={(a) => (
            <div
              onClick={() => selectAsset(a.id)}
              className={`group mb-1 w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left transition ${
                selectedAssetId === a.id
                  ? 'border-brand/30 bg-brand/8'
                  : 'border-transparent hover:bg-surface'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm font-medium text-ink">{a.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-faint">
                    {a.description || preview(a.content, a.meta)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    void toggleAssetFavorite(a.id)
                  }}
                  className={`shrink-0 rounded p-0.5 ${
                    a.favorite
                      ? 'text-brand'
                      : 'text-faint opacity-0 hover:text-brand group-hover:opacity-100'
                  }`}
                >
                  <Star size={15} fill={a.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-faint">
                {a.tags.slice(0, 3).map((t) => (
                  <span key={t} className="rounded bg-surface-2 px-1.5">
                    #{t}
                  </span>
                ))}
                <span className="ml-auto">{relativeTime(a.updatedAt)}</span>
              </div>
            </div>
          )}
        />
      )}
    </section>
  )
}
