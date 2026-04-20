import { FieldValue } from "firebase-admin/firestore";
import type { ClosetProfile } from "@/lib/agents/contracts";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  buildClosetProfileFromItems,
  normalizeClosetItems,
  normalizeSizeProfile,
  type ClosetItem,
  type SizeProfile
} from "@/lib/closet/model";
import {
  deleteImageFromSupabaseStorage,
  hasSupabaseStorageConfig,
  uploadImageToSupabaseStorage
} from "@/lib/supabase/storage";

type PersistClosetInput = {
  userId: string;
  email?: string | null;
  items: ClosetItem[];
  closetProfile?: Partial<ClosetProfile> | null;
  sizeProfile?: SizeProfile | null;
};

function stripUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as T;
}

function getStorageRef(item: ClosetItem) {
  if (!item.storage_bucket || !item.storage_path) {
    return null;
  }

  return {
    bucket: item.storage_bucket,
    path: item.storage_path
  };
}

async function normalizePersistentItem(item: ClosetItem, userId: string): Promise<ClosetItem> {
  if (!item.photo_data_url || !hasSupabaseStorageConfig()) {
    return item;
  }

  const uploaded = await uploadImageToSupabaseStorage(item.photo_data_url, userId);

  return {
    ...item,
    photo_data_url: "",
    image_url: uploaded.publicUrl ?? item.image_url ?? "",
    storage_bucket: uploaded.bucket,
    storage_path: uploaded.path
  };
}

export async function persistClosetItemsForUser(input: PersistClosetInput) {
  const db = getFirebaseAdminFirestore();

  if (!db) {
    throw new Error("missing_firebase_admin_config");
  }

  const normalizedItems = normalizeClosetItems(input.items);
  const persistedItems = await Promise.all(
    normalizedItems.map((item) => normalizePersistentItem(item, input.userId))
  );
  const closetProfile = {
    ...buildClosetProfileFromItems(
      persistedItems,
      input.closetProfile?.avoid ?? ""
    ),
    ...(input.closetProfile?.avoid !== undefined
      ? { avoid: input.closetProfile.avoid ?? "" }
      : {})
  };
  const userRef = db.collection("users").doc(input.userId);
  const collectionRef = userRef.collection("closetItems");
  const currentSnapshot = await collectionRef.get();
  const nextIds = new Set(persistedItems.map((item) => item.id));
  const batch = db.batch();

  persistedItems.forEach((item) => {
    batch.set(
      collectionRef.doc(item.id),
      stripUndefined({
        ...item,
        updatedAt: FieldValue.serverTimestamp()
      }),
      { merge: true }
    );
  });

  currentSnapshot.docs.forEach((itemDoc) => {
    if (!nextIds.has(itemDoc.id)) {
      batch.delete(itemDoc.ref);
    }
  });

  batch.set(
    userRef,
    stripUndefined({
      updatedAt: FieldValue.serverTimestamp(),
      email: input.email ?? null,
      closet_profile: closetProfile,
      closet_items: persistedItems,
      size_profile: normalizeSizeProfile(input.sizeProfile ?? undefined)
    }),
    { merge: true }
  );

  await batch.commit();

  const removedStorageRefs = currentSnapshot.docs
    .filter((itemDoc) => !nextIds.has(itemDoc.id))
    .map((itemDoc) => getStorageRef(itemDoc.data() as ClosetItem))
    .filter((ref): ref is { bucket: string; path: string } => Boolean(ref));

  await Promise.allSettled(
    removedStorageRefs.map((ref) => deleteImageFromSupabaseStorage(ref))
  );

  return {
    closet_items: persistedItems,
    closet_profile: closetProfile
  };
}
