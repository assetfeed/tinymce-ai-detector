/**
 * The three commands, made over CKEditor's Command class (passed in, so this file does not import the editor). They change no
 * model data, so they stay usable in read-only mode and never reach the undo stack.
 */

import { VIEWS } from '@assetfeed/ai-detector-core/controller.js'

/** @param {typeof import('ckeditor5').Command} Command  @param {() => object|null} detector  the check cycle, once the editor is ready */
export function createCommands(Command, detector) {
    class Base extends Command {
        constructor(editor) {
            super(editor)
            this.affectsData = false
        }
    }

    /** editor.execute('checkAiWriting'): returns a promise that settles when the check is over. */
    class CheckAiWritingCommand extends Base {
        refresh() {
            this.isEnabled = Boolean(detector()) && detector().state.status !== 'busy'
        }

        execute() {
            return detector()?.check()
        }
    }

    /** editor.execute('clearAiMarks') */
    class ClearAiMarksCommand extends Base {
        refresh() {
            this.isEnabled = Boolean(detector()?.state.result)
        }

        execute() {
            detector()?.clear()
        }
    }

    /** editor.execute('setAiMarksView', 'highlight' | 'bars' | 'off'); the value is the current view. */
    class SetAiMarksViewCommand extends Base {
        refresh() {
            this.isEnabled = Boolean(detector()?.state.result)
            this.value = detector()?.state.view ?? 'highlight'
        }

        execute(view) {
            if (VIEWS.includes(view)) {
                detector()?.setView(view)
            }
        }
    }

    return { CheckAiWritingCommand, ClearAiMarksCommand, SetAiMarksViewCommand }
}
