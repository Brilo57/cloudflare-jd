const form = document.getElementById("jd-form");
const input = document.getElementById("jd-input");
const submitButton = document.getElementById("submit-button");
const buyButton = document.getElementById("buy-button");
const resetButton = document.getElementById("reset-button");
const statusCard = document.getElementById("status-card");
const statusText = document.getElementById("status-text");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultShop = document.getElementById("result-shop");
const imageWrap = document.getElementById("image-wrap");
const resultImage = document.getElementById("result-image");
const resultPrice = document.getElementById("result-price");
const resultCommission = document.getElementById("result-commission");

let currentBuyUrl = "";

function openBuyLink(url) {
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes("android");
  const isIOS = /iphone|ipad|ipod/.test(ua);

  if (isAndroid || isIOS) {
    const appUrl = `openApp.jdMobile://virtual?params={"category":"jump","des":"m","url":"${encodeURIComponent(url)}"}`;
    const startedAt = Date.now();

    window.location.href = appUrl;

    window.setTimeout(() => {
      if (Date.now() - startedAt < 3200) {
        window.location.href = url;
      }
    }, 3000);
    return;
  }

  window.open(url, "_blank", "noopener");
}

function showStatus(message, isError = false) {
  statusText.textContent = message;
  statusCard.classList.remove("hidden");
  statusCard.classList.toggle("error", isError);
}

function hideStatus() {
  statusCard.classList.add("hidden");
  statusCard.classList.remove("error");
  statusText.textContent = "";
}

function hideResult() {
  resultCard.classList.add("hidden");
  imageWrap.classList.add("hidden");
  resultImage.removeAttribute("src");
  currentBuyUrl = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const rawValue = input.value.trim();
  if (!rawValue) {
    showStatus("请先粘贴京东链接或分享文案。", true);
    hideResult();
    return;
  }

  submitButton.disabled = true;
  hideResult();
  showStatus("正在查询，请稍候...");

  try {
    const response = await fetch("/api/jd", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ jd_link: rawValue })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "查询失败，请稍后重试。");
    }

    const item = data.item;
    currentBuyUrl = item.buy_url || "";

    resultTitle.textContent = item.title || "未命名商品";
    resultShop.textContent = item.shop_title || "店铺信息暂无";
    resultPrice.textContent = item.price_after_coupon ? `¥${item.price_after_coupon}` : "暂无";
    resultCommission.textContent = item.commission ? `¥${item.commission}` : "暂无";

    if (item.image_url) {
      resultImage.src = item.image_url;
      resultImage.alt = item.title || "商品图片";
      imageWrap.classList.remove("hidden");
    } else {
      imageWrap.classList.add("hidden");
      resultImage.removeAttribute("src");
    }

    resultCard.classList.remove("hidden");
    hideStatus();
  } catch (error) {
    showStatus(error.message || "查询失败，请稍后重试。", true);
    hideResult();
  } finally {
    submitButton.disabled = false;
  }
});

buyButton.addEventListener("click", () => {
  if (!currentBuyUrl) {
    showStatus("没有可打开的购买链接。", true);
    return;
  }

  openBuyLink(currentBuyUrl);
});

resetButton.addEventListener("click", () => {
  input.value = "";
  hideStatus();
  hideResult();
  input.focus();
});
