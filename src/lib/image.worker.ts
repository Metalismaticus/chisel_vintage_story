/// <reference lib="webworker" />

import { imageToSchematic } from './schematic-utils';

self.onmessage = async (event: MessageEvent<{ file: File; threshold: number }>) => {
  try {
    const { file, threshold } = event.data;
    // Создаем ImageBitmap из файла *внутри worker'а*.
    // Это самый важный шаг, чтобы основной поток не блокировался.
    const imageBitmap = await createImageBitmap(file);
    const result = await imageToSchematic(imageBitmap, threshold);
    self.postMessage(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Произошла неизвестная ошибка в worker.';
    // Если происходит ошибка, отправляем объект ошибки обратно в основной поток.
    self.postMessage({ error: errorMessage });
  }
};

// Этот экспорт нужен для удовлетворения системы модулей.
export {};
