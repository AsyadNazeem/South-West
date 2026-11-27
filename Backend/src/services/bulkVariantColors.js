'use strict';

const headers = ['Color 1 Name', 'Color 1 HEX', 'Color 2 Name', 'Color 2 HEX'];
const comparison = new Intl.Collator('en', { sensitivity: 'base' });
const examples = [['Black','#000000'], ['White','#FFFFFF'], ['Red','#FF0000'], ['Blue','#0000FF'], ['Green','#008000'], ['Silver','#C0C0C0']];

function hasColumns(sheet, start) {
    const actual = sheet.getRow(1).values.slice(1).map(v => String(v ?? '').trim().toLowerCase());
    // Legacy templates may contain unrelated trailing notes.
    if (!actual.some(h => /^colou?r\s+\d+\b/.test(h))) return false;
    if (!headers.every((h,i) => actual[start+i] === h.toLowerCase()) ||
        actual.slice(start+4).some(h => /^colou?r\s+\d+\b/.test(h))) throw new Error('Invalid colour headers in Variants. Use the four colour columns from a fresh template.');
    return true;
}

function readColors(values, palette, errors) {
    const colors = [];
    for (let i = 0; i < headers.length; i += 2) {
        const [nameColumn, hexColumn] = headers.slice(i, i + 2);
        const name = values[nameColumn], hex = values[hexColumn];
        if ((name == null || name === '') && (hex == null || hex === '')) continue;
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 50 || /[\u{10000}-\u{10FFFF}]/u.test(name)) {
            errors.push(nameColumn + ' requires a text name of 1–50 characters supported by the catalog.');
            continue;
        }
        if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) {
            errors.push(hexColumn + ' requires a six-digit HEX code such as #1976D2.');
            continue;
        }
        const hex_code = hex.toUpperCase(), color_name = name.trim();
        if (colors.some(c => c.hex_code === hex_code)) {
            errors.push(hexColumn + ' repeats a colour on this variant.');
            continue;
        }
        const sameHex = palette.get(hex_code);
        const sameName = [...palette.values()].find(c => comparison.compare(c.color_name, color_name) === 0);
        if (sameHex && sameHex !== sameName) {
            errors.push(nameColumn + ' conflicts with the name already used for ' + hex_code + ' on this product.');
            continue;
        }
        if (sameName && !sameHex) {
            errors.push(hexColumn + ' conflicts with the code already used for ' + sameName.color_name + ' on this product.');
            continue;
        }
        if (!sameHex && palette.size >= 50) {
            errors.push(nameColumn + ' exceeds the 50-colour limit for this product.');
            continue;
        }
        const color = sameHex || { color_name, hex_code };
        palette.set(hex_code, color);
        colors.push(color);
    }
    return colors;
}

const skuSuffix = colors => colors.map(c => c.color_name).join('-');

async function linkColors(db, itemId, variantId, colors, created, transaction) {
    for (const color of colors) {
        if (!created.has(color.hex_code)) {
            const record = await db.ItemColor.create({ item_id: itemId, ...color }, { transaction });
            created.set(color.hex_code, record.id);
        }
        await db.ItemVariantColor.create({ variant_id: variantId, color_id: created.get(color.hex_code) }, { transaction });
    }
}

function addReferenceTable(sheet) {
    const start = sheet.getColumn(9), codes = sheet.getColumn(10);
    start.width = 23; codes.width = 19;
    for (const [i, text] of ['Common colour','HEX code'].entries()) {
        const cell = sheet.getCell(1,9+i);
        cell.value = text;
        cell.style = sheet.getCell('A1').style;
    }
    examples.forEach(([name,hex], i) => {
        sheet.getCell(i+2,9).value = name;
        const cell = sheet.getCell(i+2,10);
        cell.value = hex;
        cell.numFmt = '@';
        cell.fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FF'+hex.slice(1)} };
        cell.font = { color:{argb:['Black','Blue','Green'].includes(name) ? 'FFFFFFFF' : 'FF111111'} };
    });
}
module.exports = { headers, hasColumns, readColors, skuSuffix, linkColors, addReferenceTable };
