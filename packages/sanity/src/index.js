/**
 * AI writing check for Sanity Studio (v4 to v6), by AssetFeed (https://assetfeed.com/ai-content-detector).
 *
 * Every Portable Text field gets a bar under the editor. A check sends the field's text to the AssetFeed AI detector and the
 * answer is marked beside the passages: a side bar per passage (orange: likely AI, amber: unsure, green: likely human), a tint
 * behind strong passages and a card on hover. The marks are drawn in a layer beside the editable element, so they are never
 * part of the document value or its history.
 *
 *   plugins: [aiDetector({ endpoint: '/api/ai-check' })]
 */

import { createElement as h } from 'react'
import { definePlugin } from 'sanity'
import { DEFAULT_ENDPOINT } from '@assetfeed/ai-detector-core/controller.js'
import { AiDetectorInput } from './input.js'
import { isPortableText } from './text.js'

export { DEFAULT_ENDPOINT }

/**
 * Options: endpoint, apiKey, request, bar, onResult, onChange, onNotice (as in the other plugins), and
 * enabled: (inputProps) => boolean, to leave out some Portable Text fields (all of them by default).
 */
export const aiDetector = definePlugin((options = {}) => {
    const { enabled, ...rest } = options

    return {
        name: '@assetfeed/sanity-ai-detector',
        form: {
            components: {
                input: (input) => (isPortableText(input) && (enabled?.(input) ?? true) ? h(AiDetectorInput, { input, options: rest }) : input.renderDefault(input)),
            },
        },
    }
})

export default aiDetector
