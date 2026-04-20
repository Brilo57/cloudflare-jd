const JD_LINK_REGEX = /https?:\/\/(?:item(?:\.m)?\.jd\.com\/(?:product\/)?\d+(?:\.html)?|3\.cn\/[A-Za-z0-9_-]+)/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

function extractJdLink(rawInput) {
  if (!rawInput) {
    return null;
  }

  const match = String(rawInput).trim().match(JD_LINK_REGEX);
  return match ? match[0] : null;
}

function normalizeItem(item) {
  return {
    title: item.title || "",
    shop_title: item.shop_title || "",
    original_price: item.size || "",
    price_after_coupon: item.quanhou_jiage || "",
    coupon_info: item.coupon_info || "",
    commission: item.tkfee3 || "",
    good_rate: item.haopinglv || "",
    volume: item.volume || "",
    description: item.jianjie || "",
    buy_url: item.shorturl || ""
  };
}

export async function onRequestPost(context) {
  const { env, request } = context;

  if (!env.APPKEY || !env.UNION_ID) {
    return json(
      {
        ok: false,
        error: "Cloudflare 环境变量未配置完整，请设置 APPKEY 和 UNION_ID。"
      },
      500
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "请求体格式不正确。" }, 400);
  }

  const extractedLink = extractJdLink(payload.jd_link);
  if (!extractedLink) {
    return json({ ok: false, error: "没有识别到有效的京东商品链接。" }, 400);
  }

  const upstreamUrl = new URL("http://j.zhetaoke.com/api/open_jing_union_open_promotion_byunionid_get.ashx");
  upstreamUrl.searchParams.set("appkey", env.APPKEY);
  upstreamUrl.searchParams.set("materialId", extractedLink);
  upstreamUrl.searchParams.set("unionId", env.UNION_ID);
  upstreamUrl.searchParams.set("couponUrl", "");
  upstreamUrl.searchParams.set("positionId", env.POSITION_ID || "111");
  upstreamUrl.searchParams.set("giftCouponKey", "");
  upstreamUrl.searchParams.set("chainType", "3");
  upstreamUrl.searchParams.set("signurl", "5");

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: {
        "accept": "application/json"
      }
    });

    if (!upstream.ok) {
      return json({ ok: false, error: "上游接口请求失败。" }, 502);
    }

    const result = await upstream.json();
    const item = result?.content?.[0];

    if (!item) {
      return json({ ok: false, error: "没有查到商品信息，请换一个商品链接试试。" }, 404);
    }

    return json({
      ok: true,
      item: normalizeItem(item)
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "请求失败，请稍后重试。"
      },
      500
    );
  }
}
