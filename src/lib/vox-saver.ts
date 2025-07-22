// Adapted from https://github.com/FlorianFe/vox-saver.js
// Bundled and converted to TypeScript to avoid npm installation issues.

const HEADER_SIZE = 24;
const CHUNK_HEADER_SIZE = 12;

interface Voxel {
  x: number;
  y: number;
  z: number;
  c: number;
}

interface Palette {
  [index: number]: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

interface VoxData {
  voxels: Voxel[];
  palette: Palette;
  size?: {
    x: number;
    y: number;
    z: number;
  };
}

const textEncoder = new TextEncoder();

function createHeader(chunks: Uint8Array[]): Uint8Array {
  let mainContentSize = 0;
  for (const chunk of chunks) {
    mainContentSize += chunk.length;
  }
  const header = new Uint8Array(HEADER_SIZE);
  const view = new DataView(header.buffer);
  
  header.set(textEncoder.encode('VOX '), 0);
  view.setUint32(4, 150, true);
  
  header.set(textEncoder.encode('MAIN'), 8);
  view.setUint32(12, 0, true);
  view.setUint32(16, mainContentSize, true);

  return header;
}


function createChunk(id: string, data: Uint8Array, childrenData: Uint8Array = new Uint8Array(0)): Uint8Array {
  const chunk = new Uint8Array(CHUNK_HEADER_SIZE + data.length + childrenData.length);
  const view = new DataView(chunk.buffer);
  
  chunk.set(textEncoder.encode(id), 0);
  view.setUint32(4, data.length, true);
  view.setUint32(8, childrenData.length, true);
  
  chunk.set(data, CHUNK_HEADER_SIZE);
  chunk.set(childrenData, CHUNK_HEADER_SIZE + data.length);
  
  return chunk;
}

function findSize(voxels: Voxel[]): { x: number; y: number; z: number } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (const v of voxels) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    minZ = Math.min(minZ, v.z);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
    maxZ = Math.max(maxZ, v.z);
  }
  
  return {
    x: maxX - minX + 1,
    y: maxY - minY + 1,
    z: maxZ - minZ + 1,
  };
}


function createSizeChunk(size: { x: number; y: number; z: number }): Uint8Array {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, size.x, true);
  view.setUint32(4, size.y, true);
  view.setUint32(8, size.z, true);
  return createChunk('SIZE', data);
}

function createXyziChunk(voxels: Voxel[]): Uint8Array {
  const data = new Uint8Array(4 + voxels.length * 4);
  const view = new DataView(data.buffer);
  view.setUint32(0, voxels.length, true);
  
  for (let i = 0; i < voxels.length; i++) {
    const voxel = voxels[i];
    view.setUint8(4 + i * 4, voxel.x);
    view.setUint8(4 + i * 4 + 1, voxel.y);
    view.setUint8(4 + i * 4 + 2, voxel.z);
    view.setUint8(4 + i * 4 + 3, voxel.c);
  }
  
  return createChunk('XYZI', data);
}

function createRgbaChunk(palette: Palette): Uint8Array {
  const data = new Uint8Array(256 * 4);
  const view = new DataView(data.buffer);
  
  for (let i = 1; i < 256; i++) {
    const color = palette[i];
    if (color) {
      view.setUint8((i - 1) * 4, color.r);
      view.setUint8((i - 1) * 4 + 1, color.g);
      view.setUint8((i - 1) * 4 + 2, color.b);
      view.setUint8((i - 1) * 4 + 3, color.a);
    }
  }
  
  return createChunk('RGBA', data);
}

function concat(arrays: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const arr of arrays) {
        totalLength += arr.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}


export function save(data: VoxData): Uint8Array {
  const size = data.size || findSize(data.voxels);
  
  const chunks = [
    createSizeChunk(size),
    createXyziChunk(data.voxels),
    createRgbaChunk(data.palette)
  ];
  
  const header = createHeader(chunks);
  const chunkData = concat(chunks);
  
  return concat([header, chunkData]);
}
