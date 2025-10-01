import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false,
})

/**
 * 安全地將 Markdown 轉換為 HTML
 * @param markdown Markdown 文本
 * @returns 淨化後的 HTML 字串
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''

  try {
    // 將 Markdown 轉換為 HTML
    const rawHtml = marked.parse(markdown) as string

    // 使用 DOMPurify 淨化 HTML
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'img',
        'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr',
        'div', 'span'
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel',
        'src', 'alt', 'title',
        'class', 'id'
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    })

    return cleanHtml
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return markdown
  }
}

/**
 * 為代碼區塊添加複製按鈕
 * @param container 包含代碼區塊的容器元素
 */
export function addCopyButtons(container: HTMLElement) {
  if (!container) return

  const preElements = container.querySelectorAll('pre')

  preElements.forEach((pre) => {
    // 檢查是否已經有複製按鈕
    if (pre.querySelector('.code-copy-btn')) return

    // 創建複製按鈕
    const copyBtn = document.createElement('button')
    copyBtn.className = 'code-copy-btn'
    copyBtn.textContent = 'Copy'
    copyBtn.type = 'button'

    // 複製功能
    copyBtn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent || ''

      try {
        await navigator.clipboard.writeText(code)
        copyBtn.textContent = 'Copied!'
        copyBtn.classList.add('copied')

        setTimeout(() => {
          copyBtn.textContent = 'Copy'
          copyBtn.classList.remove('copied')
        }, 2000)
      } catch (error) {
        console.error('Failed to copy code:', error)
        copyBtn.textContent = 'Failed'
        setTimeout(() => {
          copyBtn.textContent = 'Copy'
        }, 2000)
      }
    })

    pre.appendChild(copyBtn)
  })
}

/**
 * Composable for Markdown rendering
 */
export function useMarkdown() {
  return {
    renderMarkdown,
    addCopyButtons,
  }
}
