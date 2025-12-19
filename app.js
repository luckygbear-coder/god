const roles = [
  "狼人","狼人","狼人","狼人",
  "預言家","女巫","獵人","守衛",
  "平民","平民","平民","平民"
];

const state = {
  godEye: false,
  selected: null,
  viewed: new Set(),
  seats: []
};

const seatsGrid = document.getElementById("seatsGrid");
const roleModal = document.getElementById("roleModal");
const roleTitle = document.getElementById("roleTitle");
const roleBody = document.getElementById("roleBody");

function init() {
  const shuffled = [...roles].sort(() => Math.random() - 0.5);
  state.seats = shuffled.map((r, i) => ({
    no: i + 1,
    role: r,
    alive: true
  }));
  renderSeats();
}

function renderSeats() {
  seatsGrid.innerHTML = "";
  state.seats.forEach(seat => {
    const div = document.createElement("div");
    div.className = "seat" +
      (state.selected === seat.no ? " selected" : "") +
      (!seat.alive ? " dead" : "");

    div.innerHTML = `
      <div class="no">${seat.no}號</div>
      <div class="meta">
        ${state.godEye ? seat.role : seat.alive ? "存活" : "死亡"}
      </div>
    `;

    let pressTimer;
    div.addEventListener("touchstart", e => {
      e.preventDefault();
      pressTimer = setTimeout(() => showRole(seat), 300);
    });
    div.addEventListener("touchend", () => clearTimeout(pressTimer));
    div.addEventListener("click", () => {
      state.selected = state.selected === seat.no ? null : seat.no;
      renderSeats();
    });

    seatsGrid.appendChild(div);
  });
}

function showRole(seat) {
  roleTitle.textContent = `${seat.no}號 身分`;
  roleBody.textContent = seat.role;
  roleModal.classList.remove("hidden");
  state.viewed.add(seat.no);
}

document.getElementById("btnRoleDone").onclick =
document.getElementById("btnRoleClose").onclick = () => {
  roleModal.classList.add("hidden");
};

document.getElementById("btnGodEye").onclick = () => {
  state.godEye = !state.godEye;
  renderSeats();
};

init();