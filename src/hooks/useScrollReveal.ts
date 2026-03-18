import { useEffect, useRef, useState } from 'react'

export interface UseScrollRevealOptions {
  threshold?: number
  rootMargin?: string
  once?: boolean
}

export function useScrollReveal<T extends HTMLElement = HTMLElement>(options: UseScrollRevealOptions = {}) {
  const { threshold = 0.18, rootMargin = '0px 0px -10% 0px', once = true } = options
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true)
          if (once) {
            observer.unobserve(node)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [once, rootMargin, threshold])

  return { ref, isVisible }
}
