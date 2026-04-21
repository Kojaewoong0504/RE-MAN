export type OutfitBoardCard = {
  title: string;
  label: string;
  imageSrc: string;
  fallbackSrc: string;
};

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("board_file_read_failed"));
    };
    reader.onerror = () => reject(new Error("board_file_read_failed"));
    reader.readAsDataURL(blob);
  });
}

async function sourceToDataUrl(src: string) {
  if (src.startsWith("data:image/")) {
    return src;
  }

  const response = await fetch(src);

  if (!response.ok) {
    throw new Error("board_source_fetch_failed");
  }

  return readBlobAsDataUrl(await response.blob());
}

async function resolveCardDataUrl(card: OutfitBoardCard) {
  try {
    return await sourceToDataUrl(card.imageSrc);
  } catch {
    return sourceToDataUrl(card.fallbackSrc);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("board_image_load_failed"));
    image.src = src;
  });
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export async function buildOutfitBoardDataUrl(cards: OutfitBoardCard[]) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("canvas_context_unavailable");
  }

  canvas.width = 1080;
  canvas.height = 1440;

  context.fillStyle = "#f4efe3";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#101a2a";
  context.font = "700 42px Arial";
  context.fillText("RE:MAN OUTFIT BOARD", 72, 92);

  context.fillStyle = "#5c6573";
  context.font = "600 28px Arial";
  context.fillText("추천 조합 전체를 한 장으로 정리한 실착 입력 이미지", 72, 138);

  const cardWidth = 288;
  const imageHeight = 436;
  const gap = 36;
  const startX = 72;
  const topY = 196;

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const x = startX + index * (cardWidth + gap);
    const y = topY;
    const resolvedSrc = await resolveCardDataUrl(card);
    const image = await loadImage(resolvedSrc);

    context.fillStyle = "#fbf8f1";
    context.strokeStyle = "#d9d0c2";
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(x, y, cardWidth, 584, 28);
    context.fill();
    context.stroke();

    context.save();
    context.beginPath();
    context.roundRect(x + 16, y + 16, cardWidth - 32, imageHeight, 22);
    context.clip();
    drawImageCover(context, image, x + 16, y + 16, cardWidth - 32, imageHeight);
    context.restore();

    context.fillStyle = "#6a7380";
    context.font = "700 22px Arial";
    context.fillText(card.label, x + 20, y + 492);

    context.fillStyle = "#101a2a";
    context.font = "700 30px Arial";
    const words = card.title.split(" ");
    let line = "";
    let lineY = y + 536;

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > cardWidth - 40 && line) {
        context.fillText(line, x + 20, lineY);
        line = word;
        lineY += 36;
      } else {
        line = next;
      }
    }

    if (line) {
      context.fillText(line, x + 20, lineY);
    }
  }

  context.fillStyle = "#101a2a";
  context.font = "700 28px Arial";
  context.fillText("TOP + BOTTOM + SHOES", 72, 1342);

  context.fillStyle = "#6a7380";
  context.font = "600 24px Arial";
  context.fillText("이 보드는 추천 조합 전체를 실착 provider에 전달하기 위한 합성 이미지입니다.", 72, 1386);

  return canvas.toDataURL("image/png");
}
