import type { Place } from "../types/place";
import styles from "./map-markers.module.css";

// Google Material Symbols Outlined(Apache-2.0) 원본 경로를 사용합니다.
const symbols = {
  child:
    '<path d="M580-490q-21 0-35.5-14.5T530-540q0-21 14.5-35.5T580-590q21 0 35.5 14.5T630-540q0 21-14.5 35.5T580-490Zm-200 0q-21 0-35.5-14.5T330-540q0-21 14.5-35.5T380-590q21 0 35.5 14.5T430-540q0 21-14.5 35.5T380-490Zm100 210q-60 0-108.5-33T300-400h360q-23 54-71.5 87T480-280Zm0 160q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm0-80q116 0 198-82t82-198q0-116-82-198t-198-82h-12q-6 0-12 2-6 6-8 13t-2 15q0 21 14.5 35.5T496-680q9 0 16.5-3t15.5-3q12 0 20 9t8 21q0 23-21.5 29.5T496-620q-45 0-77.5-32.5T386-730v-6q0-3 1-8-83 30-135 101t-52 163q0 116 82 198t198 82Zm0-280Z"/>',
  school:
    '<path d="M480-120 200-272v-240L40-600l440-240 440 240v320h-80v-276l-80 44v240L480-120Zm0-332 274-148-274-148-274 148 274 148Zm0 241 200-108v-151L480-360 280-470v151l200 108Zm0-241Zm0 90Zm0 0Z"/>',
  toys: '<path d="M280-160q-45 0-78.5-28.5T162-262q-38-20-60-57t-22-81q0-53 30.5-94.5T192-552l-72-72-12 12q-11 11-28 11t-28-11q-11-11-11-28t11-28l80-80q11-11 28-11t28 11q11 11 11 28t-11 28l-12 12 56 56 32-94q12-37 43.5-59.5T378-800h204q39 0 70.5 22.5T696-718l54 162q57 11 93.5 55T880-400q0 44-22 81t-60 57q-6 45-39.5 73.5T680-160q-38 0-68.5-22T568-240H392q-13 36-43.5 58T280-160Zm16-400h144v-160h-62q-13 0-23 7.5T340-692l-44 132Zm224 0h144l-44-132q-5-13-15-20.5t-23-7.5h-62v160ZM392-320h176q13-36 43.5-58t68.5-22q30 0 56 14t44 38q9-11 14.5-24.5T800-400q0-33-23.5-56.5T720-480H240q-33 0-56.5 23.5T160-400q0 14 5.5 27.5T180-348q18-24 44-38t56-14q38 0 68.5 22t43.5 58Zm-112 80q17 0 28.5-11.5T320-280q0-17-11.5-28.5T280-320q-17 0-28.5 11.5T240-280q0 17 11.5 28.5T280-240Zm400 0q17 0 28.5-11.5T720-280q0-17-11.5-28.5T680-320q-17 0-28.5 11.5T640-280q0 17 11.5 28.5T680-240ZM480-400Z"/>',
  care: '<path d="M260-720q-33 0-56.5-23.5T180-800q0-33 23.5-56.5T260-880q33 0 56.5 23.5T340-800q0 33-23.5 56.5T260-720Zm420 200q-25 0-42.5-17.5T620-580q0-25 17.5-42.5T680-640q25 0 42.5 17.5T740-580q0 25-17.5 42.5T680-520ZM180-80v-280h-60v-240q0-33 23.5-56.5T200-680h120q22 0 40 10.5t29 29.5l143 247 41-61q8-12 21.5-19t28.5-7h117q25 0 42.5 17.5T800-420v140h-40v200H600v-284l-31 44h-88L380-496v416H180Z"/>',
};

function categoryStyle(category: string) {
  if (/어린이집|유치원/.test(category))
    return { color: "#fd761a", symbol: symbols.care };
  if (/돌봄|키움|학교/.test(category))
    return { color: "#9d4300", symbol: symbols.school };
  if (/지원센터|장난감|도서관/.test(category))
    return { color: "#6c5100", symbol: symbols.toys };
  return { color: "#0d7a73", symbol: symbols.child };
}

export function createPlaceMarker(place: Place) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = styles.marker;
  button.setAttribute("aria-label", `${place.name} 시설 상세보기`);
  button.setAttribute("aria-haspopup", "dialog");
  button.dataset.placeId = place.id;
  const { color, symbol } = categoryStyle(place.category);
  button.style.setProperty("--marker-color", color);
  // 상수 SVG만 HTML로 넣고, 제공처 문자열은 textContent로 처리합니다.
  button.innerHTML = `<span class="${styles.pin}" aria-hidden="true"><svg viewBox="0 -960 960 960" fill="currentColor">${symbol}</svg></span><span class="${styles.label}"></span><span class="${styles.callout}"><span class="${styles.name}"></span><span class="${styles.category}"></span></span>`;
  button.querySelector(`.${styles.label}`)!.textContent = place.name;
  button.querySelector(`.${styles.name}`)!.textContent = place.name;
  button.querySelector(`.${styles.category}`)!.textContent =
    place.category || "시설";
  return button;
}

export function selectPlaceMarker(
  button: HTMLButtonElement,
  selected: boolean,
) {
  button.dataset.selected = String(selected);
  button.setAttribute("aria-pressed", String(selected));
}

export function createLocationMarker() {
  const dot = document.createElement("div");
  dot.className = styles.location;
  dot.setAttribute("role", "img");
  dot.setAttribute("aria-label", "현재 위치");
  return dot;
}
