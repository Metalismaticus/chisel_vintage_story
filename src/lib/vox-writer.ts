// A lightweight, self-contained .vox file writer based on the format specification.
// This avoids external dependencies that have caused installation issues.

export interface Voxel {
    x: number;
    y: number;
    z: number;
    colorIndex: number;
}

export interface PaletteColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface VoxData {
    size: { x: number; y: number; z: number };
    voxels: Voxel[];
    palette?: PaletteColor[];
}

const defaultPalette: PaletteColor[] = [
    { r: 255, g: 255, b: 255, a: 255 }, { r: 255, g: 255, b: 0, a: 255 },
    { r: 255, g: 0, b: 255, a: 255 }, { r: 255, g: 0, b: 0, a: 255 },
    { r: 0, g: 255, b: 255, a: 255 }, { r: 0, g: 255, b: 0, a: 255 },
    { r: 0, g: 0, b: 255, a: 255 }, { r: 0, g: 0, b: 0, a: 255 }
];


function writeString(dataView: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        dataView.setUint8(offset + i, str.charCodeAt(i));
    }
    return offset + str.length;
}

function writeInt(dataView: DataView, offset: number, value: number) {
    dataView.setInt32(offset, value, true);
    return offset + 4;
}

function writeChunk(id: string, content: Uint8Array, children: Uint8Array) {
    const view = new DataView(new ArrayBuffer(12));
    writeString(view, 0, id);
    writeInt(view, 4, content.byteLength);
    writeInt(view, 8, children.byteLength);

    const result = new Uint8Array(12 + content.byteLength + children.byteLength);
    result.set(new Uint8Array(view.buffer), 0);
    result.set(content, 12);
    result.set(children, 12 + content.byteLength);
    return result;
}

export function writeVox(data: VoxData): Uint8Array {
    const { size, voxels } = data;
    const palette = data.palette || defaultPalette;

    // SIZE chunk
    const sizeContent = new Uint8Array(12);
    const sizeView = new DataView(sizeContent.buffer);
    writeInt(sizeView, 0, size.x);
    writeInt(sizeView, 4, size.y);
    writeInt(sizeView, 8, size.z);
    const sizeChunk = writeChunk('SIZE', sizeContent, new Uint8Array(0));

    // XYZI chunk
    const xyziContent = new Uint8Array(4 + voxels.length * 4);
    const xyziView = new DataView(xyziContent.buffer);
    writeInt(xyziView, 0, voxels.length);
    let offset = 4;
    for (const voxel of voxels) {
        xyziView.setUint8(offset++, voxel.x);
        xyziView.setUint8(offset++, voxel.y);
        xyziView.setUint8(offset++, voxel.z);
        xyziView.setUint8(offset++, voxel.colorIndex);
    }
    const xyziChunk = writeChunk('XYZI', xyziContent, new Uint8Array(0));

    // RGBA chunk
    const rgbaContent = new Uint8Array(palette.length * 4);
    const rgbaView = new DataView(rgbaContent.buffer);
    offset = 0;
    for (const color of palette) {
        rgbaView.setUint8(offset++, color.r);
        rgbaView.setUint8(offset++, color.g);
        rgbaView.setUint8(offset++, color.b);
        rgbaView.setUint8(offset++, color.a);
    }
    // MagicaVoxel requires a full 256 color palette, so we pad with zeroes
    const fullRgbaContent = new Uint8Array(256 * 4);
    fullRgbaContent.set(rgbaContent, 0);
     // The first color is reserved, so we add a dummy color at the end of our used palette
    if (palette.length < 255) {
        fullRgbaContent[rgbaContent.length] = 0;
        fullRgbaContent[rgbaContent.length+1] = 0;
        fullRgbaContent[rgbaContent.length+2] = 0;
        fullRgbaContent[rgbaContent.length+3] = 0;
    }


    const rgbaChunk = writeChunk('RGBA', fullRgbaContent, new Uint8Array(0));

    // MAIN chunk (contains other chunks)
    const packContent = new Uint8Array(4);
    writeInt(new DataView(packContent.buffer), 0, 1); // number of models
    const packChunk = writeChunk('PACK', packContent, new Uint8Array(0));
    
    const mainChildren = new Uint8Array(packChunk.byteLength + sizeChunk.byteLength + xyziChunk.byteLength + rgbaChunk.byteLength);
    mainChildren.set(packChunk, 0);
    mainChildren.set(sizeChunk, packChunk.byteLength);
    mainChildren.set(xyziChunk, packChunk.byteLength + sizeChunk.byteLength);
    mainChildren.set(rgbaChunk, packChunk.byteLength + sizeChunk.byteLength + xyziChunk.byteLength);
    
    const mainChunk = writeChunk('MAIN', new Uint8Array(0), mainChildren);

    // VOX file header
    const header = new Uint8Array(8);
    const headerView = new DataView(header.buffer);
    writeString(headerView, 0, 'VOX ');
    writeInt(headerView, 4, 150); // version

    const result = new Uint8Array(header.byteLength + mainChunk.byteLength);
    result.set(header, 0);
    result.set(mainChunk, 8);

    return result;
}
