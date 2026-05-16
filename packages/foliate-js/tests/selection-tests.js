import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hasActiveTextSelection } from '../selection.js'

const makeDocumentWithSelection = selection => ({
    getSelection: () => selection,
})

describe('selection helpers', () => {
    it('detects an active non-collapsed text range selection', () => {
        const doc = makeDocumentWithSelection({
            rangeCount: 1,
            getRangeAt: () => ({ collapsed: false }),
        })

        assert.equal(hasActiveTextSelection(doc), true)
    })

    it('does not treat collapsed or missing selections as active text selection', () => {
        assert.equal(hasActiveTextSelection(null), false)
        assert.equal(hasActiveTextSelection(makeDocumentWithSelection(null)), false)
        assert.equal(
            hasActiveTextSelection(
                makeDocumentWithSelection({
                    rangeCount: 1,
                    getRangeAt: () => ({ collapsed: true }),
                }),
            ),
            false,
        )
    })
})
