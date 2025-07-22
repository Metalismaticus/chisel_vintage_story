// A standalone script to write .vox files, based on the format specification
// and learnings from other parsers. No external dependencies.

interface Voxel {
    x: number;
    y: number;
    z: number;
    colorIndex: number;
}

interface PaletteColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

interface VoxData {
    voxels: Voxel[];
    palette: PaletteColor[];
    size: {
        x: number;
        y: number;
        z: number;
    }
}

const textEncoder = new TextEncoder();

function writeInt(value: number): Uint8Array {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, value, true);
    return new Uint8Array(buffer);
}

function writeString(value: string): Uint8Array {
    return textEncoder.encode(value);
}

function writeChunk(id: string, content: Uint8Array, children: Uint8Array = new Uint8Array(0)): Uint8Array {
    const idBytes = writeString(id);
    const contentSize = writeInt(content.length);
    const childrenSize = writeInt(children.length);

    const chunk = new Uint8Array(idBytes.length + 8 + content.length + children.length);
    chunk.set(idBytes, 0);
    chunk.set(contentSize, 4);
    chunk.set(childrenSize, 8);
    chunk.set(content, 12);
    chunk.set(children, 12 + content.length);

    return chunk;
}

export function write(data: VoxData): Uint8Array {
    const { voxels, palette, size } = data;

    // ---- SIZE chunk ----
    const sizeContent = new Uint8Array(12);
    sizeContent.set(writeInt(size.x), 0);
    sizeContent.set(writeInt(size.y), 4);
    sizeContent.set(writeInt(size.z), 8);
    const sizeChunk = writeChunk('SIZE', sizeContent);

    // ---- XYZI chunk (voxels) ----
    const xyziContent = new Uint8Array(4 + voxels.length * 4);
    xyziContent.set(writeInt(voxels.length), 0);
    const voxelDataView = new DataView(xyziContent.buffer, 4);
    voxels.forEach((v, i) => {
        voxelDataView.setUint8(i * 4, v.x);
        voxelDataView.setUint8(i * 4 + 1, v.y);
        voxelDataView.setUint8(i * 4 + 2, v.z);
        voxelDataView.setUint8(i * 4 + 3, v.colorIndex);
    });
    const xyziChunk = writeChunk('XYZI', xyziContent);
    
    // ---- RGBA chunk (palette) ----
    const rgbaContent = new Uint8Array(palette.length * 4);
    const paletteDataView = new DataView(rgbaContent.buffer);
    palette.forEach((c, i) => {
        paletteDataView.setUint8(i * 4, c.r);
        paletteDataView.setUint8(i * 4 + 1, c.g);
        paletteDataView.setUint8(i * 4 + 2, c.b);
        paletteDataView.setUint8(i * 4 + 3, c.a);
    });
    // The palette in .vox files has 256 colors, index 0 is empty.
    // Our single color is at index 1. We pad the rest.
    const finalRgbaContent = new Uint8Array(256 * 4);
    finalRgbaContent.set(rgbaContent, 4); // Start at index 1 (byte 4)
    const rgbaChunk = writeChunk('RGBA', finalRgbaContent);
    
    // ---- MAIN chunk (container) ----
    const mainChildren = new Uint8Array(sizeChunk.length + xyziChunk.length + rgbaChunk.length);
    mainChildren.set(sizeChunk, 0);
    mainChildren.set(xyziChunk, sizeChunk.length);
    mainChildren.set(rgbaChunk, sizeChunk.length + xyziChunk.length);
    
    const mainChunk = writeChunk('MAIN', new Uint8Array(0), mainChildren);
    
    // ---- Final file ----
    const header = new Uint8Array([
        ...writeString('VOX '),
        ...writeInt(150) // Version number
    ]);
    
    const file = new Uint8Array(header.length + mainChunk.length);
    file.set(header, 0);
    file.set(mainChunk, header.length);

    return file;
}
