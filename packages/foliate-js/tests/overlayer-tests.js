import { Overlayer } from '../overlayer.js'

const marker = Overlayer.noteMarker([{ right: 160, top: 32 }])
const hitArea = marker.children[0]
const bookmark = marker.children[1]

console.assert(marker.querySelector('text') === null,
    'note marker should not render a text label')
console.assert(hitArea?.tagName?.toLowerCase() === 'rect',
    'note marker should include a transparent hit area')
console.assert(hitArea?.getAttribute('fill') === 'transparent',
    'note marker hit area should be invisible')
console.assert(hitArea?.getAttribute('width') === '15',
    'note marker hit area should remain finger-friendly')
console.assert(bookmark?.tagName?.toLowerCase() === 'path',
    'note marker should render a bookmark path')
console.assert(bookmark?.getAttribute('fill') === '#2563eb',
    'note marker should keep the reader note color')
console.assert(bookmark?.getAttribute('opacity') === '0.42',
    'note marker should be semi-transparent')
console.assert(bookmark?.getAttribute('d') === 'M 155.5 21 L 164.5 21 L 164.5 33 L 160 30 L 155.5 33 Z',
    'note marker should be a 9x12 bookmark at the selected text end')
