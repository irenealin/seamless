"use client";

export function RestaurantCard({
  item,
  badge,
  onClick,
}: {
  item: any;
  badge?: string;
  onClick?: () => void;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET;
  const makePublicUrl = (path: string) => {
    if (!supabaseUrl || !bucket) return path;
    const safe = encodeURIComponent(path).replace(/%2F/g, "/");
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${safe}`;
  };

  const fromArray = (item.image_paths ?? [])
    .map((p: string) => p.trim())
    .filter(Boolean)
    .map((p: string) => (p.startsWith("http") ? p : makePublicUrl(p)));

  const photos =
    fromArray.length > 0
      ? fromArray
      : (item.bestRoom?.room_photo_link ?? "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map((p: string) => (p.startsWith("http") ? p : makePublicUrl(p)));

  return (
    <div className="resultCard" onClick={onClick}>
      <div className="heroImg">
        {photos[0] ? <img src={photos[0]} alt="" /> : null}
      </div>
      <div className="resultBody">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p className="title">{item.restaurant_name ?? item.restaurant ?? "Unknown restaurant"}</p>
            <p className="small sub">{item.address ?? ""}</p>
          </div>
          {badge ? <div className="badge badgeTop">{badge}</div> : null}
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          <div className="small">
            <b>Best room:</b> {item.bestRoom?.room_name ?? "—"}
          </div>
          <div className="small">
            <b>Capacity:</b> {item.bestRoom?.seated_capacity ?? "—"} seated
          </div>
          <div className="small">
            <b>Min spend:</b>{" "}
            {item.bestRoom?.min_spend_estimate ? `$${item.bestRoom.min_spend_estimate}` : "—"}
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(item.reasons ?? []).slice(0, 3).map((r: string) => (
            <span key={r} className="badge" style={{ fontWeight: 700 }}>
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
