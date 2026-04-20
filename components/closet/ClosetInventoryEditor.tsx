"use client";

import { useState } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import type { ClosetItem, ClosetItemCategory } from "@/lib/onboarding/storage";
import { normalizePhotoForBrowserUpload } from "@/lib/upload/browser-normalize";
import { IMAGE_INPUT_ACCEPT, validatePhotoFile } from "@/lib/upload/photo-input";

const categoryOptions: Array<{ value: ClosetItemCategory; label: string }> = [
  { value: "tops", label: "상의" },
  { value: "bottoms", label: "하의" },
  { value: "shoes", label: "신발" },
  { value: "outerwear", label: "겉옷" }
];

const categoryLabels: Record<ClosetItemCategory, string> = {
  tops: "상의",
  bottoms: "하의",
  shoes: "신발",
  outerwear: "겉옷"
};

const categorySlots: Record<ClosetItemCategory, string> = {
  tops: "행거",
  bottoms: "서랍",
  shoes: "하단",
  outerwear: "긴 칸"
};

const wearStateOptions = ["선택 안 함", "조금 작음", "잘 맞음", "조금 큼"];
const wearFrequencyOptions = ["선택 안 함", "자주 입음", "가끔 입음", "거의 안 입음"];
const seasonOptions = ["선택 안 함", "봄/가을", "여름", "겨울", "사계절"];
const conditionOptions = ["선택 안 함", "깨끗함", "사용감 있음", "수선 필요", "오염 있음"];

function createClosetItemId() {
  return `closet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function countByCategory(items: ClosetItem[], category: ClosetItemCategory) {
  return items.filter((item) => item.category === category).length;
}

function getItemDisplayName(item: ClosetItem) {
  const name = item.name.trim();
  const color = item.color?.trim();

  if (!color || name.includes(color)) {
    return name;
  }

  return `${color} ${name}`;
}

function getItemImageSrc(item: ClosetItem) {
  return item.photo_data_url || item.image_url || "";
}

export function ClosetInventoryEditor({
  items,
  onChange
}: {
  items: ClosetItem[];
  onChange: (items: ClosetItem[]) => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<ClosetItemCategory>("tops");
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [fit, setFit] = useState("");
  const [size, setSize] = useState("");
  const [wearState, setWearState] = useState("");
  const [wearFrequency, setWearFrequency] = useState("");
  const [season, setSeason] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isModeChoosing, setIsModeChoosing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<ClosetItemCategory[]>([]);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  const photoPreviewSrc = photoDataUrl || imageUrl;
  const canAdd = Boolean(photoPreviewSrc);
  const isEditing = Boolean(editingItemId);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  function resetForm() {
    setName("");
    setColor("");
    setFit("");
    setSize("");
    setWearState("");
    setWearFrequency("");
    setSeason("");
    setCondition("");
    setNotes("");
    setPhotoDataUrl("");
    setImageUrl("");
    setStorageBucket("");
    setStoragePath("");
    setPhotoError(null);
  }

  function openAddModal() {
    resetForm();
    setEditingItemId(null);
    setShowOptionalDetails(false);
    setIsModeChoosing(false);
    setIsAdding(true);
  }

  function openAddChooser() {
    setIsModeChoosing(true);
  }

  function openBatchCapture() {
    setIsModeChoosing(false);
    router.push("/closet/batch");
  }

  function openEditModal(item: ClosetItem) {
    setCategory(item.category);
    setName(item.name);
    setColor(item.color ?? "");
    setFit(item.fit ?? "");
    setSize(item.size ?? "");
    setWearState(item.wear_state ?? "");
    setWearFrequency(item.wear_frequency ?? "");
    setSeason(item.season ?? "");
    setCondition(item.condition ?? "");
    setNotes(item.notes ?? "");
    setPhotoDataUrl(item.photo_data_url ?? "");
    setImageUrl(item.image_url ?? "");
    setStorageBucket(item.storage_bucket ?? "");
    setStoragePath(item.storage_path ?? "");
    setPhotoError(null);
    setEditingItemId(item.id);
    setShowOptionalDetails(true);
    setIsAdding(true);
  }

  function closeModal() {
    resetForm();
    setEditingItemId(null);
    setShowOptionalDetails(false);
    setIsAdding(false);
  }

  async function handlePhotoChange(file: File) {
    setPhotoError(null);

    const validation = validatePhotoFile(file);

    if (!validation.ok) {
      setPhotoError(validation.message);
      setPhotoDataUrl("");
      return;
    }

    try {
      setPhotoDataUrl(await normalizePhotoForBrowserUpload(file));
      setImageUrl("");
      setStorageBucket("");
      setStoragePath("");
    } catch {
      setPhotoError("사진을 처리하지 못했습니다. JPG 또는 PNG 사진을 다시 선택해주세요.");
      setPhotoDataUrl("");
    }
  }

  function handleSubmitItem() {
    if (!canAdd) {
      return;
    }

    const nextItem: ClosetItem = {
      id: editingItemId ?? createClosetItemId(),
      category,
      name: name.trim() || `${categoryLabels[category]} 사진`,
      photo_data_url: photoDataUrl,
      image_url: imageUrl,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      color: color.trim(),
      fit: fit.trim(),
      size: size.trim(),
      wear_state: wearState.trim(),
      wear_frequency: wearFrequency.trim(),
      season: season.trim(),
      condition: condition.trim(),
      notes: notes.trim()
    };

    if (editingItemId) {
      onChange(items.map((item) => (item.id === editingItemId ? nextItem : item)));
    } else {
      onChange([...items, nextItem]);
    }

    setOpenCategories((current) =>
      current.includes(category) ? current : [...current, category]
    );
    setSelectedItemId(nextItem.id);
    closeModal();
  }

  function handleRemoveItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
  }

  function toggleCategory(nextCategory: ClosetItemCategory) {
    setOpenCategories((current) =>
      current.includes(nextCategory)
        ? current.filter((value) => value !== nextCategory)
        : [...current, nextCategory]
    );
  }

  return (
    <section className="closet-workspace">
      <div className="closet-toolbar">
        <div>
          <p className="poster-kicker">Inventory</p>
          <h2>내 옷장</h2>
        </div>
        <button
          aria-label="옷 추가"
          className="closet-add-button"
          onClick={openAddChooser}
          type="button"
        >
          +
        </button>
      </div>

      <div className="closet-cabinet" aria-label="옷장 프레임">
        <div className="closet-cabinet-top">
          <span>RE:MAN CLOSET</span>
          <span>{items.length} pcs</span>
        </div>
        <div className="closet-cabinet-body" aria-label="옷장 목록">
        {categoryOptions.map((option) => {
          const categoryItems = items.filter((item) => item.category === option.value);
          const isOpen = openCategories.includes(option.value);

          return (
            <section
              className={`closet-shelf closet-shelf-${option.value} ${
                isOpen ? "closet-shelf-open" : "closet-shelf-closed"
              }`}
              key={option.value}
            >
              <button
                aria-expanded={isOpen}
                className="closet-shelf-header"
                onClick={() => toggleCategory(option.value)}
                type="button"
              >
                <div>
                  <p>{option.label}</p>
                  <span>{categorySlots[option.value]} · {categoryItems.length}</span>
                </div>
                <span className="closet-shelf-toggle">{isOpen ? "닫기" : "열기"}</span>
              </button>
              {isOpen && (option.value === "tops" || option.value === "outerwear") ? (
                <div className="closet-hanger-rail" aria-hidden="true" />
              ) : null}
              {isOpen ? (
                <div className="closet-rail">
                  {categoryItems.length > 0 ? (
                    categoryItems.map((item) => (
                      <button
                        className={`closet-item-tile ${
                          selectedItemId === item.id ? "closet-item-tile-selected" : ""
                        }`}
                        key={item.id}
                        onClick={() =>
                          setSelectedItemId(selectedItemId === item.id ? null : item.id)
                        }
                        type="button"
                      >
                        <span className="closet-item-photo">
                          {getItemImageSrc(item) ? (
                            <NextImage
                              alt={`${getItemDisplayName(item)} 옷장 사진`}
                              className="h-full w-full object-cover"
                              height={160}
                              src={getItemImageSrc(item)}
                              unoptimized
                              width={120}
                            />
                          ) : (
                            <span>legacy</span>
                          )}
                        </span>
                        <span className="closet-item-name">{getItemDisplayName(item)}</span>
                      </button>
                    ))
                  ) : (
                    <div className="closet-empty-slot">
                      <span aria-hidden="true" />
                      <p>첫 옷을 걸어두세요</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="closet-closed-face">
                  <span>{categoryItems.length > 0 ? `${categoryItems.length}개 보관` : "추가 필요"}</span>
                  <span>탭해서 열기</span>
                </div>
              )}
            </section>
          );
        })}
        </div>
      </div>

      {selectedItem ? (
        <section className="closet-detail-drawer">
          <div>
            <p className="poster-kicker">{categoryLabels[selectedItem.category]}</p>
            <h3>{getItemDisplayName(selectedItem)}</h3>
            {[selectedItem.fit, selectedItem.size, selectedItem.wear_state, selectedItem.wear_frequency, selectedItem.season, selectedItem.condition, selectedItem.notes]
              .filter(Boolean)
              .length > 0 ? (
              <p>
                {[selectedItem.fit, selectedItem.size, selectedItem.wear_state, selectedItem.wear_frequency, selectedItem.season, selectedItem.condition, selectedItem.notes]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : (
              <p>추가 메모 없음</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              className="text-sm font-black text-muted underline underline-offset-4"
              onClick={() => openEditModal(selectedItem)}
              type="button"
            >
              수정
            </button>
            <button
              className="text-sm font-black text-muted underline underline-offset-4"
              onClick={() => handleRemoveItem(selectedItem.id)}
              type="button"
            >
              삭제
            </button>
          </div>
        </section>
      ) : null}

      {items.length === 0 ? (
        <div className="closet-empty-state">
          <p>아직 옷장 사진이 없습니다.</p>
          <button onClick={openAddChooser} type="button">
            첫 옷 추가
          </button>
        </div>
      ) : null}

      {isModeChoosing ? (
        <div aria-label="옷 추가 방식" className="closet-mode-sheet" role="dialog">
          <button className="closet-mode-primary" onClick={openBatchCapture} type="button">
            <span>빠른 촬영</span>
            <small>여러 벌을 한 번에 추가</small>
          </button>
          <button className="closet-mode-secondary" onClick={openAddModal} type="button">
            <span>한 벌 직접 등록</span>
            <small>사진 1장과 메모를 직접 입력</small>
          </button>
          <button
            className="text-sm font-black text-muted underline underline-offset-4"
            onClick={() => setIsModeChoosing(false)}
            type="button"
          >
            닫기
          </button>
        </div>
      ) : null}

      {isAdding ? (
        <div className="closet-modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="closet-modal"
            role="dialog"
          >
            <div className="closet-modal-header">
              <div>
                <p className="poster-kicker">{isEditing ? "Edit" : "Add"}</p>
                <h2>{isEditing ? "옷 수정" : "옷 추가"}</h2>
              </div>
              <button
                aria-label="닫기"
                className="closet-modal-close"
                onClick={closeModal}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="closet-photo-first">
              <div className="closet-photo-preview">
                {photoPreviewSrc ? (
                  <NextImage
                    alt="등록할 옷장 사진 미리보기"
                    className="h-full w-full object-cover"
                    height={450}
                    src={photoPreviewSrc}
                    unoptimized
                    width={360}
                  />
                ) : (
                  <div>
                    <p>사진 먼저</p>
                    <span>옷 하나가 잘 보이게 찍어주세요</span>
                  </div>
                )}
              </div>
              <div className="closet-photo-first-actions">
                <div className="grid grid-cols-2 gap-2">
                  <label className="ui-button cursor-pointer py-4" htmlFor="closet-photo-upload">
                    {photoPreviewSrc ? "다시 선택" : "사진 선택"}
                  </label>
                  <label
                    className="ui-button-secondary cursor-pointer justify-center py-4"
                    htmlFor="closet-photo-camera"
                  >
                    카메라 촬영
                  </label>
                </div>
                <input
                  accept={IMAGE_INPUT_ACCEPT}
                  className="sr-only"
                  id="closet-photo-upload"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];

                    if (!file) {
                      return;
                    }

                    await handlePhotoChange(file);
                    event.target.value = "";
                  }}
                  type="file"
                />
                <input
                  accept={IMAGE_INPUT_ACCEPT}
                  capture="environment"
                  className="sr-only"
                  id="closet-photo-camera"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];

                    if (!file) {
                      return;
                    }

                    await handlePhotoChange(file);
                    event.target.value = "";
                  }}
                  type="file"
                />
                {photoError ? (
                  <p className="text-sm font-black leading-6 text-red-700">{photoError}</p>
                ) : null}
                <p>사진과 종류만으로 저장할 수 있습니다.</p>
              </div>
            </div>

            <div className="grid gap-3">
              <label className="space-y-2">
                <span className="text-sm font-black text-ink">종류</span>
                <select
                  className="ui-input w-full"
                  onChange={(event) => setCategory(event.target.value as ClosetItemCategory)}
                  value={category}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              aria-expanded={showOptionalDetails}
              className="closet-optional-toggle"
              onClick={() => setShowOptionalDetails((current) => !current)}
              type="button"
            >
              <span>{showOptionalDetails ? "선택 정보 닫기" : "선택 정보 열기"}</span>
              <span>{showOptionalDetails ? "접기" : "→"}</span>
            </button>

            {showOptionalDetails ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-ink">아이템 이름</span>
                  <input
                    className="ui-input w-full"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="흰색 티셔츠"
                    value={name}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-black text-ink">색</span>
                  <input
                    className="ui-input w-full"
                    onChange={(event) => setColor(event.target.value)}
                    placeholder="흰색"
                    value={color}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-black text-ink">핏</span>
                  <input
                    className="ui-input w-full"
                    onChange={(event) => setFit(event.target.value)}
                    placeholder="레귤러"
                    value={fit}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-black text-ink">사이즈</span>
                  <input
                    className="ui-input w-full"
                    onChange={(event) => setSize(event.target.value)}
                    placeholder="M, 32, 270"
                    value={size}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-black text-ink">착용감</span>
                  <select
                    className="ui-input w-full"
                    onChange={(event) =>
                      setWearState(event.target.value === "선택 안 함" ? "" : event.target.value)
                    }
                    value={wearState || "선택 안 함"}
                  >
                    {wearStateOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-black text-ink">빈도</span>
                  <select
                    className="ui-input w-full"
                    onChange={(event) =>
                      setWearFrequency(event.target.value === "선택 안 함" ? "" : event.target.value)
                    }
                    value={wearFrequency || "선택 안 함"}
                  >
                    {wearFrequencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-black text-ink">계절</span>
                  <select
                    className="ui-input w-full"
                    onChange={(event) =>
                      setSeason(event.target.value === "선택 안 함" ? "" : event.target.value)
                    }
                    value={season || "선택 안 함"}
                  >
                    {seasonOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-black text-ink">상태</span>
                  <select
                    className="ui-input w-full"
                    onChange={(event) =>
                      setCondition(event.target.value === "선택 안 함" ? "" : event.target.value)
                    }
                    value={condition || "선택 안 함"}
                  >
                    {conditionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-black text-ink">메모</span>
                  <input
                    className="ui-input w-full"
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="자주 입음"
                    value={notes}
                  />
                </label>
              </div>
            ) : null}

            <button
              className="ui-button-secondary justify-between py-4 disabled:opacity-50"
              disabled={!canAdd}
              onClick={handleSubmitItem}
              type="button"
            >
              <span>
                {photoDataUrl
                  ? isEditing
                    ? "변경 저장"
                    : "사진을 옷장에 추가"
                  : "사진을 먼저 선택"}
              </span>
              <span>{isEditing ? "✓" : "+"}</span>
            </button>
          </section>
        </div>
      ) : null}
    </section>
  );
}
