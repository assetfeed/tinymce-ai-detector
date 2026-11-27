/**
 * AI writing check for CKEditor 5, by AssetFeed (https://assetfeed.com/ai-content-detector).
 *
 * The plugin sends the editor's text to the AssetFeed AI detector and marks the answer next to the text: a side bar per
 * passage (orange: likely AI, amber: unsure, green: likely human), a tint behind strong passages and a card on hover.
 * The marks are drawn in a layer beside the editable element, not in the model, so nothing reaches editor.getData() or the
 * undo history.
 *
 *   ClassicEditor.create(element, { plugins: [Essentials, Paragraph, AiDetector], toolbar: ['checkAiWriting'],
 *     aiDetector: { endpoint: '/my-proxy/ai-check' } })
 *   editor.execute('checkAiWriting')
 */

import { ButtonView, Command, Plugin } from 'ckeditor5'
import { collectBlocks } from '@assetfeed/ai-detector-core/marks.js'
import { DEFAULT_ENDPOINT, DEFAULT_OPTIONS, createController } from '@assetfeed/ai-detector-core/controller.js'
import { createCommands } from './commands.js'

export { DEFAULT_ENDPOINT }

// Lucide Bot (ISC licence). CKEditor fills every svg child that has no fill attribute, so each shape says fill="none".
const ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'
    + '<path fill="none" d="M12 8V4H8"/><rect fill="none" width="16" height="12" x="4" y="8" rx="2"/><path fill="none" d="M2 14h2"/><path fill="none" d="M20 14h2"/><path fill="none" d="M15 13v2"/><path fill="none" d="M9 13v2"/></svg>'
const CLEAR_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'
    + '<path fill="none" d="M18 6 6 18"/><path fill="none" d="m6 6 12 12"/></svg>'

export class AiDetector extends Plugin {
    static get pluginName() {
        return 'AiDetector'
    }

    constructor(editor) {
        super(editor)
        editor.config.define('aiDetector', { ...DEFAULT_OPTIONS })

        /** The check cycle, once the editor is ready: state, check(), clear(), setView(), refresh(). */
        this.detector = null
    }

    init() {
        const editor = this.editor
        const { CheckAiWritingCommand, ClearAiMarksCommand, SetAiMarksViewCommand } = createCommands(Command, () => this.detector)
        const commands = {
            checkAiWriting: new CheckAiWritingCommand(editor),
            clearAiMarks: new ClearAiMarksCommand(editor),
            setAiMarksView: new SetAiMarksViewCommand(editor),
        }

        for (const [name, command] of Object.entries(commands)) {
            editor.commands.add(name, command)
        }

        const button = (name, label, icon) => editor.ui.componentFactory.add(name, (locale) => {
            const view = new ButtonView(locale)
            const command = commands[name]

            view.set({ label, icon, tooltip: true })
            view.bind('isEnabled').to(command, 'isEnabled')
            view.on('execute', () => {
                editor.execute(name)
                editor.editing.view.focus()
            })

            return view
        })

        button('checkAiWriting', 'Check for AI writing', ICON)
        button('clearAiMarks', 'Clear AI marks', CLEAR_ICON)

        editor.once('ready', () => this.start())
    }

    start() {
        const editor = this.editor
        const view = editor.editing.view
        const root = () => view.getDomRoot()
        const refreshCommands = () => ['checkAiWriting', 'clearAiMarks', 'setAiMarksView'].forEach((name) => editor.commands.get(name)?.refresh())

        // The element the editor lives in, or the editable itself for an editor without a frame (inline, decoupled).
        const frame = () => editor.ui.view.element ?? root()
        const options = editor.config.get('aiDetector')

        this.detector = createController({
            source: 'ckeditor5-ai-detector',
            options: { ...options, onChange: (state) => { refreshCommands(); options.onChange?.(state) } },
            root,
            blocks: () => (root() ? collectBlocks(root()) : []),
            placeBar: (bar) => frame().after(bar),
        })

        // The model changed: once the view is drawn again, the answer is checked against the text it was made for.
        let dirty = false

        this.listenTo(editor.model.document, 'change:data', () => { dirty = true })
        this.listenTo(view.document, 'layoutChanged', () => {
            if (dirty) {
                dirty = false
                this.detector.refresh()
            }
        })
        refreshCommands()
    }

    destroy() {
        this.detector?.destroy()
        this.detector = null
        super.destroy()
    }
}

export default AiDetector
