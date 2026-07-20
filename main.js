import { io } from 'socket.io-client';
import { Chess } from 'chess.js';

// Game Constants
const ELIXIR_COSTS = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9
};

const PIECE_SYMBOLS = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Helper coordinate mappings
const getSquareName = (x, y) => FILES[x] + (y + 1);
const parseSquareName = (square) => {
  const x = square.charCodeAt(0) - 97;
  const y = parseInt(square[1]) - 1;
  return { x, y };
};

// Determine server URL dynamically: if running on local dev server port 5173, point to backend port 3000 on the same host
let SERVER_URL = window.location.port === '5173'
  ? `http://${window.location.hostname}:3000`
  : (import.meta.env.VITE_BACKEND_URL || "");

// Automatically upgrade http:// to https:// in production when served over secure HTTPS
if (window.location.protocol === 'https:' && SERVER_URL.startsWith('http://')) {
  SERVER_URL = SERVER_URL.replace('http://', 'https://');
}

// Proactively send a health check request to wake up Render free tier container immediately on load
if (SERVER_URL) {
  fetch(`${SERVER_URL}/health`)
    .then(() => console.log("Backend server health check succeeded (server is awake)."))
    .catch((err) => console.log("Proactive server wakeup request dispatched."));
}

console.log(`Connecting to backend server at: ${SERVER_URL}`);
const socket = io(SERVER_URL, { autoConnect: false });

// Game State variables
let chess = new Chess();
let playerElixirs = { w: 2, b: 0 };
let isOfflineMode = false;          // Local pass-and-play fallback
let myColor = null;                 // 'w' or 'b' (online mode only)
let activeTurn = 'w';               // 'w' or 'b'
let selectedTile = null;            // {x, y}
let selectedShopPiece = null;       // 'pawn', 'knight', etc.
let dragSource = null;              // {source: 'board'/'shop', x, y, piece}
let availableMoves = [];            // Array of square names
let placementSquares = [];          // Array of square names
let playerNames = null;             // Active player names in room

// Auth State
let loggedInUser = localStorage.getItem('clash_chess_user') || null;
let authMode = 'login';             // 'login' or 'register'

// DOM Elements
const lobbySetup = document.getElementById('lobby-setup');
const lobbyWaiting = document.getElementById('lobby-waiting');
const gameBoardContainer = document.getElementById('game-board-container');
const lobbyStatus = document.getElementById('lobby-status');
const roomCodeDisplay = document.getElementById('room-code-display');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnPlayOffline = document.getElementById('btn-play-offline');
const btnCancelRoom = document.getElementById('btn-cancel-room');
const inputRoomCode = document.getElementById('input-room-code');

const boardEl = document.getElementById('chess-board');
const whiteElixirFill = document.getElementById('white-elixir-fill');
const whiteElixirText = document.getElementById('white-elixir-text');
const blackElixirFill = document.getElementById('black-elixir-fill');
const blackElixirText = document.getElementById('black-elixir-text');
const whiteCard = document.getElementById('player-white-card');
const blackCard = document.getElementById('player-black-card');
const turnAnnouncement = document.getElementById('turn-announcement');
const btnRestart = document.getElementById('btn-restart');
const gameOverOverlay = document.getElementById('game-over-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const btnOverlayRestart = document.getElementById('btn-overlay-restart');
const shopCards = document.querySelectorAll('.shop-item-card');

// Auth DOM Elements
const authModal = document.getElementById('auth-modal');
const btnCloseAuth = document.getElementById('btn-close-auth');
const headerAuthContainer = document.getElementById('header-auth');
const authFormView = document.getElementById('auth-form-view');
const authProfileView = document.getElementById('auth-profile-view');
const authTitle = document.getElementById('auth-title');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const btnAuthAction = document.getElementById('btn-auth-action');
const btnToggleAuth = document.getElementById('btn-toggle-auth');
const profileUsernameDisplay = document.getElementById('profile-username');
const statPlayed = document.getElementById('stat-played');
const statWinrate = document.getElementById('stat-winrate');
const statWins = document.getElementById('stat-wins');
const statLosses = document.getElementById('stat-losses');
const btnLogout = document.getElementById('btn-logout');

// --- 0. AUTHENTICATION & STATISTICS ---

async function fetchStats(username) {
  if (!SERVER_URL) return;
  try {
    const res = await fetch(`${SERVER_URL}/api/stats/${username}`);
    if (res.ok) {
      const data = await res.json();
      const stats = data.stats;
      statPlayed.innerText = stats.gamesPlayed;
      statWins.innerText = stats.wins;
      statLosses.innerText = stats.losses;
      
      const wr = stats.gamesPlayed > 0 
        ? Math.round((stats.wins / stats.gamesPlayed) * 100) 
        : 0;
      statWinrate.innerText = `${wr}%`;
    }
  } catch (err) {
    console.error("Error fetching stats:", err);
  }
}

function initAuth() {
  if (loggedInUser) {
    authFormView.classList.add('hidden');
    authProfileView.classList.remove('hidden');
    profileUsernameDisplay.innerText = loggedInUser.toUpperCase();
    fetchStats(loggedInUser);

    // Update Top Right Header with profile pill
    headerAuthContainer.innerHTML = `
      <div class="user-profile-pill" id="btn-show-profile">
        <span class="profile-pill-avatar">👤</span>
        <span class="profile-pill-username">${loggedInUser.toUpperCase()}</span>
      </div>
    `;

    document.getElementById('btn-show-profile').addEventListener('click', () => {
      authFormView.classList.add('hidden');
      authProfileView.classList.remove('hidden');
      authModal.classList.remove('hidden');
      fetchStats(loggedInUser);
    });
  } else {
    authFormView.classList.remove('hidden');
    authProfileView.classList.add('hidden');

    // Update Top Right Header with Login button
    headerAuthContainer.innerHTML = `
      <button id="btn-show-auth" class="btn-secondary auth-trigger-btn">Log In / Sign Up</button>
    `;

    document.getElementById('btn-show-auth').addEventListener('click', () => {
      authFormView.classList.remove('hidden');
      authProfileView.classList.add('hidden');
      authModal.classList.remove('hidden');
    });
  }
}

// Modal dismiss events
btnCloseAuth.addEventListener('click', () => {
  authModal.classList.add('hidden');
});

authModal.addEventListener('click', (e) => {
  if (e.target === authModal) {
    authModal.classList.add('hidden');
  }
});

btnToggleAuth.addEventListener('click', () => {
  if (authMode === 'login') {
    authMode = 'register';
    authTitle.innerText = "PLAYER SIGN UP";
    btnAuthAction.innerText = "Sign Up";
    btnToggleAuth.innerText = "Log In";
    document.querySelector('.auth-toggle-text').innerHTML = `Already have an account? <span id="btn-toggle-auth" style="color: var(--color-gold); cursor: pointer; text-decoration: underline;">Log In</span>`;
  } else {
    authMode = 'login';
    authTitle.innerText = "PLAYER LOGIN";
    btnAuthAction.innerText = "Log In";
    btnToggleAuth.innerText = "Sign Up";
    document.querySelector('.auth-toggle-text').innerHTML = `Don't have an account? <span id="btn-toggle-auth" style="color: var(--color-gold); cursor: pointer; text-decoration: underline;">Sign Up</span>`;
  }
  // Re-attach toggle listener since we overwrote innerHTML
  document.getElementById('btn-toggle-auth').addEventListener('click', () => btnToggleAuth.click());
});

btnAuthAction.addEventListener('click', async () => {
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;

  if (!username || !password) {
    alert("Please enter both username and password.");
    return;
  }

  if (username.length < 3) {
    alert("Username must be at least 3 characters.");
    return;
  }

  if (!SERVER_URL) {
    alert("No server connection URL detected. Make sure your server is online.");
    return;
  }

  const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
  try {
    const res = await fetch(`${SERVER_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      if (authMode === 'register') {
        // Auto-login after registration
        authMode = 'login';
        btnAuthAction.click();
      } else {
        // Login success
        loggedInUser = data.user.username;
        localStorage.setItem('clash_chess_user', loggedInUser);
        authUsernameInput.value = "";
        authPasswordInput.value = "";
        
        initAuth();
        authModal.classList.add('hidden'); // Close modal
        
        // Register socket user association
        if (socket.connected) {
          socket.emit('register_socket_user', { username: loggedInUser });
        }
      }
    } else {
      alert(data.reason || "Authentication request failed.");
    }
  } catch (err) {
    console.error("Auth HTTP request failed:", err);
    alert("Unable to communicate with authentication server.");
  }
});

btnLogout.addEventListener('click', () => {
  localStorage.removeItem('clash_chess_user');
  loggedInUser = null;
  initAuth();
  authModal.classList.add('hidden'); // Close modal
  
  if (socket.connected) {
    socket.emit('register_socket_user', { username: null });
  }
});

// Run Auth Initialization immediately on script load
initAuth();

// --- 1. LOBBY MATCHMAKING INTERACTION HANDLERS ---

// Connect and trigger action helper
function connectSocket(callback) {
  if (!SERVER_URL) {
    lobbyStatus.innerHTML = "<span style='color: #f87171;'>⚠️ Production backend URL is not configured. Please add the <strong>VITE_BACKEND_URL</strong> environment variable in Vercel, or click 'Play Offline' below to play locally!</span>";
    return;
  }
  if (!socket.connected) {
    lobbyStatus.innerText = "Connecting to server (waking up Render instance)...";
    socket.connect();
    
    socket.once('connect', () => {
      lobbyStatus.innerText = "Server Connected.";
      if (loggedInUser) {
        socket.emit('register_socket_user', { username: loggedInUser });
      }
      callback();
    });

    socket.once('connect_error', () => {
      lobbyStatus.innerText = "Connection failed. Backend server may be starting up, please try again in a few seconds!";
    });
  } else {
    if (loggedInUser) {
      socket.emit('register_socket_user', { username: loggedInUser });
    }
    callback();
  }
}

// Create Game Lobby Room
btnCreateRoom.addEventListener('click', () => {
  connectSocket(() => {
    socket.emit('create_room');
  });
});

// Join Game Lobby Room
btnJoinRoom.addEventListener('click', () => {
  const code = inputRoomCode.value.toUpperCase().trim();
  if (code.length !== 5) {
    alert("Please enter a valid 5-letter Room Code.");
    return;
  }
  connectSocket(() => {
    socket.emit('join_room', { roomId: code });
  });
});

// Start Offline Pass-and-Play
btnPlayOffline.addEventListener('click', () => {
  console.log("Starting offline pass-and-play mode...");
  isOfflineMode = true;
  myColor = null; // null color enables dragging both White and Black pieces
  
  // Reset Chess state
  chess = new Chess();
  chess.clear();
  chess.put({ type: 'k', color: 'w' }, 'e1');
  chess.put({ type: 'k', color: 'b' }, 'e8');
  
  const fenParts = chess.fen().split(' ');
  fenParts[1] = 'w';
  chess.load(fenParts.join(' '));
  
  playerElixirs = { w: 2, b: 0 };
  activeTurn = 'w';
  selectedTile = null;
  selectedShopPiece = null;
  dragSource = null;
  availableMoves = [];
  placementSquares = [];
  
  // Toggle layout containers
  lobbySetup.classList.add('hidden');
  lobbyWaiting.classList.add('hidden');
  gameBoardContainer.classList.remove('hidden');
  
  updateUI();
});

// Cancel Waiting / Leave Lobby
btnCancelRoom.addEventListener('click', () => {
  socket.disconnect();
  resetToLobby();
});

// Leave active game board
btnRestart.addEventListener('click', () => {
  if (confirm("Are you sure you want to leave the game?")) {
    if (!isOfflineMode) {
      socket.disconnect();
    }
    isOfflineMode = false;
    resetToLobby();
  }
});

btnOverlayRestart.addEventListener('click', () => {
  hideGameOver();
  if (!isOfflineMode) {
    socket.disconnect();
  }
  isOfflineMode = false;
  resetToLobby();
});

function resetToLobby() {
  myColor = null;
  selectedTile = null;
  selectedShopPiece = null;
  dragSource = null;
  availableMoves = [];
  placementSquares = [];
  playerNames = null;
  
  gameBoardContainer.classList.add('hidden');
  lobbyWaiting.classList.add('hidden');
  lobbySetup.classList.remove('lobby-setup-container', 'hidden');
  lobbySetup.classList.add('lobby-setup-container');
  lobbyStatus.innerText = socket.connected ? "Ready to host or join." : "Server disconnected.";
}

// --- 2. WEBSOCKET STATE SYNCHRONIZATION ---

socket.on('room_created', ({ roomId }) => {
  console.log(`Room created: ${roomId}`);
  lobbySetup.classList.add('hidden');
  lobbyWaiting.classList.remove('hidden');
  roomCodeDisplay.innerText = roomId;
});

socket.on('room_joined', ({ roomId, yourColor }) => {
  console.log(`Match started inside Room ${roomId}, color assigned: ${yourColor}`);
  if (!yourColor) {
    alert("⚠️ Protocol Error: Server did not assign a player color! Please make sure your Render backend has the latest server/index.js code deployed and has finished building.");
  }
  myColor = yourColor;

  lobbySetup.classList.add('hidden');
  lobbyWaiting.classList.add('hidden');
  gameBoardContainer.classList.remove('hidden');

  // Draw board view matching player direction immediately
  updateUI();
});

socket.on('game_state_update', ({ fen, turn, whiteElixir, blackElixir, gameStatus, winner, playerNames: names }) => {
  if (isOfflineMode) return;
  console.log(`State update: turn=${turn}, elixirs=W:${whiteElixir} B:${blackElixir}`);
  
  chess.load(fen);
  activeTurn = turn;
  playerElixirs = { w: whiteElixir, b: blackElixir };
  playerNames = names;

  updateUI();

  if (gameStatus === 'checkmate') {
    const winnerName = winner === 'w' ? 'White' : 'Black';
    showGameOver('CHECKMATE!', `${winnerName} Player Wins!`);
    // Refresh player profile stats if logged in
    if (loggedInUser) {
      setTimeout(() => fetchStats(loggedInUser), 1500);
    }
  } else if (gameStatus === 'stalemate') {
    showGameOver('STALEMATE!', 'Draw Game');
    if (loggedInUser) {
      setTimeout(() => fetchStats(loggedInUser), 1500);
    }
  }
});

socket.on('invalid_action', ({ reason }) => {
  alert(reason);
  updateUI();
});

socket.on('opponent_disconnected', ({ reason }) => {
  alert(reason);
  socket.disconnect();
  resetToLobby();
});

// --- 3. CLASSIC STARTING SQUARE VALIDATION ---

function isClassicStartingSquare(ptype, color, x, y) {
  if (color === 'w') {
    if (ptype === 'pawn') return y === 1;
    if (y !== 0) return false;
    if (ptype === 'knight') return x === 1 || x === 6;
    if (ptype === 'bishop') return x === 2 || x === 5;
    if (ptype === 'rook') return x === 0 || x === 7;
    if (ptype === 'queen') return x === 3;
  } else {
    if (ptype === 'pawn') return y === 6;
    if (y !== 7) return false;
    if (ptype === 'knight') return x === 1 || x === 6;
    if (ptype === 'bishop') return x === 2 || x === 5;
    if (ptype === 'rook') return x === 0 || x === 7;
    if (ptype === 'queen') return x === 3;
  }
  return false;
}

// --- 4. OFFLINE LOCAL PASS-AND-PLAY MOTORS ---

function makeMoveLocal(from, to) {
  try {
    const move = chess.move({ from, to, promotion: 'q' });
    if (move) {
      switchTurnLocal();
      return true;
    }
  } catch (err) {
    console.warn("Invalid chess move attempted:", err.message);
  }
  return false;
}

function placePieceLocal(ptype, to) {
  try {
    const cost = ELIXIR_COSTS[ptype];
    const turn = chess.turn();
    if (playerElixirs[turn] < cost) return false;

    const { x, y } = parseSquareName(to);
    if (!isClassicStartingSquare(ptype, turn, x, y)) return false;
    if (chess.get(to)) return false;

    const typeMap = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q' };
    chess.put({ type: typeMap[ptype], color: turn }, to);

    // Spend elixir
    playerElixirs[turn] -= cost;

    // Toggle Turn manually
    const fenParts = chess.fen().split(' ');
    fenParts[1] = turn === 'w' ? 'b' : 'w';
    fenParts[3] = '-'; // Clear en-passant
    chess.load(fenParts.join(' '));

    switchTurnLocal();
    return true;
  } catch (err) {
    console.error("Error during piece placement:", err);
  }
  return false;
}

function switchTurnLocal() {
  const turn = chess.turn();
  playerElixirs[turn] += 2;
  activeTurn = turn;
  updateUI();
  checkGameStatusLocal();
}

function checkGameStatusLocal() {
  const turn = chess.turn();
  const elixir = playerElixirs[turn];

  const inCheck = chess.inCheck();
  const hasChessMoves = chess.moves().length > 0;
  const canPlace = canPlaceAnyPiece(chess, elixir, turn);

  if (inCheck && !hasChessMoves) {
    const canEscape = canEscapeCheckByPlacement(chess, elixir, turn);
    if (!canEscape) {
      showGameOver('CHECKMATE!', `${turn === 'w' ? 'Black' : 'White'} Player Wins!`);
      return true;
    }
  }

  if (!inCheck && !hasChessMoves && !canPlace) {
    showGameOver('STALEMATE!', 'Draw Game');
    return true;
  }

  return false;
}

function canPlaceAnyPiece(chessInstance, elixir, turn) {
  const affordable = Object.keys(ELIXIR_COSTS).filter(p => elixir >= ELIXIR_COSTS[p]);
  if (affordable.length === 0) return false;

  const spawnRows = turn === 'w' ? [0, 1] : [6, 7];
  for (const ptype of affordable) {
    for (let x = 0; x < 8; x++) {
      for (const y of spawnRows) {
        if (isClassicStartingSquare(ptype, turn, x, y)) {
          if (!chessInstance.get(getSquareName(x, y))) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function canEscapeCheckByPlacement(chessInstance, elixir, turn) {
  const affordable = Object.keys(ELIXIR_COSTS).filter(p => elixir >= ELIXIR_COSTS[p]);
  if (affordable.length === 0) return false;

  const spawnRows = turn === 'w' ? [0, 1] : [6, 7];
  const typeMap = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q' };
  const originalFen = chessInstance.fen();

  for (const ptype of affordable) {
    const jsType = typeMap[ptype];
    for (let x = 0; x < 8; x++) {
      for (const y of spawnRows) {
        if (isClassicStartingSquare(ptype, turn, x, y)) {
          const square = getSquareName(x, y);
          if (!chessInstance.get(square)) {
            try {
              chessInstance.put({ type: jsType, color: turn }, square);
              const stillInCheck = chessInstance.inCheck();
              chessInstance.load(originalFen);
              if (!stillInCheck) return true;
            } catch (err) {
              console.error("Temporary check verification error:", err);
            }
          }
        }
      }
    }
  }
  return false;
}

// --- 5. GAME UI DRAWING AND BOARD RENDERING ---

function updateUI() {
  const turn = activeTurn;
  
  // Highlight who we are on the player cards
  const whiteTitle = document.querySelector('#player-white-card .player-title');
  const blackTitle = document.querySelector('#player-black-card .player-title');
  if (whiteTitle && blackTitle) {
    if (isOfflineMode) {
      whiteTitle.innerText = `WHITE PLAYER`;
      blackTitle.innerText = `BLACK PLAYER`;
    } else {
      const wName = playerNames ? playerNames.w : 'Anonymous';
      const bName = playerNames ? playerNames.b : 'Anonymous';
      whiteTitle.innerText = `${wName.toUpperCase()} ${myColor === 'w' ? '(YOU)' : ''}`;
      blackTitle.innerText = `${bName.toUpperCase()} ${myColor === 'b' ? '(YOU)' : ''}`;
    }
  }

  // Update Turn title announcement
  let announcement = `${turn === 'w' ? 'White' : 'Black'}'s Turn`;
  if (isOfflineMode) {
    announcement += " (Local)";
  } else if (myColor) {
    announcement += ` (${myColor === turn ? 'Your Turn' : "Opponent's Turn"})`;
  }
  turnAnnouncement.innerText = announcement;
  
  if (turn === 'w') {
    whiteCard.classList.add('active-turn');
    blackCard.classList.remove('active-turn');
  } else {
    blackCard.classList.add('active-turn');
    whiteCard.classList.remove('active-turn');
  }

  // Update Elixirs
  whiteElixirFill.style.width = `${Math.min(10, playerElixirs.w) * 10}%`;
  whiteElixirText.innerText = `${playerElixirs.w} Elixir`;
  blackElixirFill.style.width = `${Math.min(10, playerElixirs.b) * 10}%`;
  blackElixirText.innerText = `${playerElixirs.b} Elixir`;

  // Shop cards interactivity
  shopCards.forEach(card => {
    const ptype = card.dataset.piece;
    const cost = ELIXIR_COSTS[ptype];
    const iconEl = card.querySelector('.shop-item-icon');
    
    const jsPieceMap = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q' };
    iconEl.innerText = PIECE_SYMBOLS[turn][jsPieceMap[ptype]];

    // Verify shop item usability
    const canInteract = isOfflineMode
      ? (playerElixirs[turn] >= cost)
      : (myColor === turn && playerElixirs[turn] >= cost);

    if (canInteract) {
      card.style.opacity = '1';
      card.style.cursor = 'grab';
      card.setAttribute('draggable', 'true');
    } else {
      card.style.opacity = '0.5';
      card.style.cursor = 'not-allowed';
      card.setAttribute('draggable', 'false');
    }

    if (selectedShopPiece === ptype) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  calculateIndicators();
  renderBoard();
}

function calculateIndicators() {
  availableMoves = [];
  placementSquares = [];

  let sourceSquare = null;
  if (dragSource && dragSource.source === 'board') {
    sourceSquare = getSquareName(dragSource.x, dragSource.y);
  } else if (selectedTile) {
    sourceSquare = getSquareName(selectedTile.x, selectedTile.y);
  }

  if (sourceSquare) {
    const moves = chess.moves({ square: sourceSquare, verbose: true });
    availableMoves = moves.map(m => m.to);
  }

  let activeShopPiece = null;
  if (dragSource && dragSource.source === 'shop') {
    activeShopPiece = dragSource.piece;
  } else if (selectedShopPiece) {
    activeShopPiece = selectedShopPiece;
  }

  if (activeShopPiece) {
    const turn = activeTurn;
    const spawnRows = turn === 'w' ? [0, 1] : [6, 7];
    for (let x = 0; x < 8; x++) {
      for (const y of spawnRows) {
        if (isClassicStartingSquare(activeShopPiece, turn, x, y)) {
          const sq = getSquareName(x, y);
          if (!chess.get(sq)) {
            placementSquares.push(sq);
          }
        }
      }
    }
  }
}

function renderBoard() {
  console.log(`renderBoard: Rendering board. myColor=${myColor}, offline=${isOfflineMode}`);
  boardEl.innerHTML = '';

  // Determine drawing order for flipped board if playing as Black ('b')
  const yValues = myColor === 'b' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const xValues = myColor === 'b' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  for (const y of yValues) {
    for (const x of xValues) {
      const square = getSquareName(x, y);
      const piece = chess.get(square);
      
      const tile = document.createElement('div');
      tile.className = `tile ${(x + y) % 2 === 1 ? 'light' : 'dark'}`;
      tile.dataset.x = x;
      tile.dataset.y = y;
      tile.dataset.square = square;

      // Class overlays
      if (selectedTile && selectedTile.x === x && selectedTile.y === y) {
        tile.classList.add('selected');
      }
      if (dragSource && dragSource.source === 'board' && dragSource.x === x && dragSource.y === y) {
        tile.classList.add('drag-source');
      }

      if (availableMoves.includes(square)) {
        tile.classList.add('indicator-move');
      }
      if (placementSquares.includes(square)) {
        tile.classList.add('indicator-spawn');
      }

      if (piece) {
        const isDraggedBoardPiece = (dragSource && dragSource.source === 'board' && dragSource.x === x && dragSource.y === y);
        if (!isDraggedBoardPiece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
          pieceEl.innerText = PIECE_SYMBOLS[piece.color][piece.type];
          pieceEl.setAttribute('draggable', 'true');
          
          // Disable dragging opponent's pieces OR dragging when it's not our turn
          const canDrag = isOfflineMode
            ? (piece.color === activeTurn)
            : (piece.color === myColor && activeTurn === myColor);

          if (!canDrag) {
            pieceEl.style.cursor = 'not-allowed';
            pieceEl.setAttribute('draggable', 'false');
          }

          // HTML5 Drag Handlers for pieces
          pieceEl.addEventListener('dragstart', (e) => {
            const allowed = isOfflineMode
              ? (piece.color === activeTurn)
              : (piece.color === myColor && activeTurn === myColor);
            
            if (!allowed) {
              e.preventDefault();
              return;
            }
            dragSource = { source: 'board', x, y };
            pieceEl.classList.add('dragging');
            
            calculateIndicators();
            const tiles = boardEl.querySelectorAll('.tile');
            tiles.forEach(t => {
              const sq = t.dataset.square;
              if (availableMoves.includes(sq)) t.classList.add('indicator-move');
              if (dragSource.x === parseInt(t.dataset.x) && dragSource.y === parseInt(t.dataset.y)) {
                t.classList.add('drag-source');
              }
            });

            // Set custom ghost image
            const ghost = document.createElement('div');
            ghost.className = `drag-ghost ${piece.color === 'w' ? 'white' : 'black'}`;
            ghost.innerText = PIECE_SYMBOLS[piece.color][piece.type];
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 25, 25);
            setTimeout(() => ghost.remove(), 0);
          });

          pieceEl.addEventListener('dragend', () => {
            pieceEl.classList.remove('dragging');
            dragSource = null;
            updateUI();
          });

          tile.appendChild(pieceEl);
        }
      }

      // Tile Drop event handlers
      tile.addEventListener('dragover', (e) => {
        e.preventDefault(); // allow drops
      });

      tile.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragSource) return;

        const targetSquare = tile.dataset.square;
        
        if (dragSource.source === 'board') {
          const fromSquare = getSquareName(dragSource.x, dragSource.y);
          if (availableMoves.includes(targetSquare)) {
            if (isOfflineMode) {
              makeMoveLocal(fromSquare, targetSquare);
            } else {
              socket.emit('make_move', { from: fromSquare, to: targetSquare });
            }
          }
        } else if (dragSource.source === 'shop') {
          if (placementSquares.includes(targetSquare)) {
            if (isOfflineMode) {
              placePieceLocal(dragSource.piece, targetSquare);
            } else {
              socket.emit('spawn_piece', { piece: dragSource.piece, to: targetSquare });
            }
          }
        }
        
        dragSource = null;
        selectedTile = null;
        selectedShopPiece = null;
        updateUI();
      });

      // Click event handler
      tile.addEventListener('click', (e) => {
        e.stopPropagation();

        // Click resolution on indicator overlays
        if (availableMoves.includes(square) && selectedTile) {
          const fromSquare = getSquareName(selectedTile.x, selectedTile.y);
          if (isOfflineMode) {
            makeMoveLocal(fromSquare, square);
          } else {
            socket.emit('make_move', { from: fromSquare, to: square });
          }
          selectedTile = null;
          updateUI();
          return;
        }

        if (placementSquares.includes(square) && selectedShopPiece) {
          if (isOfflineMode) {
            placePieceLocal(selectedShopPiece, square);
          } else {
            socket.emit('spawn_piece', { piece: selectedShopPiece, to: square });
          }
          selectedShopPiece = null;
          updateUI();
          return;
        }

        // Standard select clicks (only allowed if it's our piece AND our turn)
        const canSelect = isOfflineMode
          ? (piece && piece.color === activeTurn)
          : (activeTurn === myColor && piece && piece.color === myColor);

        if (canSelect) {
          selectedTile = { x, y };
          selectedShopPiece = null;
        } else {
          selectedTile = null;
          selectedShopPiece = null;
        }
        updateUI();
      });

      boardEl.appendChild(tile);
    }
  }
}

// Shop Card Event Handlers
shopCards.forEach(card => {
  card.addEventListener('dragstart', (e) => {
    const ptype = card.dataset.piece;
    const cost = ELIXIR_COSTS[ptype];
    const turn = activeTurn;

    const canDrag = isOfflineMode
      ? (playerElixirs[turn] >= cost)
      : (myColor === turn && playerElixirs[turn] >= cost);

    if (!canDrag) {
      e.preventDefault();
      return;
    }

    dragSource = { source: 'shop', piece: ptype };
    card.classList.add('dragging');

    calculateIndicators();
    const tiles = boardEl.querySelectorAll('.tile');
    tiles.forEach(t => {
      const sq = t.dataset.square;
      if (placementSquares.includes(sq)) t.classList.add('indicator-spawn');
    });

    const jsPieceMap = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q' };
    const ghost = document.createElement('div');
    ghost.className = `drag-ghost ${turn === 'w' ? 'white' : 'black'}`;
    ghost.innerText = PIECE_SYMBOLS[turn][jsPieceMap[ptype]];
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 25, 25);
    setTimeout(() => ghost.remove(), 0);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    dragSource = null;
    updateUI();
  });

  card.addEventListener('click', (e) => {
    e.stopPropagation();
    const ptype = card.dataset.piece;
    const cost = ELIXIR_COSTS[ptype];
    const turn = activeTurn;

    const canSelect = isOfflineMode
      ? (playerElixirs[turn] >= cost)
      : (myColor === turn && playerElixirs[turn] >= cost);

    if (canSelect) {
      if (selectedShopPiece === ptype) {
        selectedShopPiece = null;
      } else {
        selectedShopPiece = ptype;
        selectedTile = null;
      }
      updateUI();
    }
  });
});

// Clear selections when clicking empty space
document.addEventListener('click', () => {
  if (selectedTile || selectedShopPiece) {
    selectedTile = null;
    selectedShopPiece = null;
    updateUI();
  }
});

// Game Over Overlay Utilities
function showGameOver(title, subtitle) {
  overlayTitle.innerText = title;
  overlaySubtitle.innerText = subtitle;
  gameOverOverlay.classList.remove('hidden');
}

function hideGameOver() {
  gameOverOverlay.classList.add('hidden');
}

// Global Key Listeners (Restart on R)
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    if (isOfflineMode) {
      // Re-trigger offline start to reset local variables
      btnPlayOffline.click();
    } else {
      initGame();
    }
  }
});

btnRestart.addEventListener('click', () => {
  if (isOfflineMode) {
    btnPlayOffline.click();
  } else {
    initGame();
  }
});

btnOverlayRestart.addEventListener('click', () => {
  hideGameOver();
  if (isOfflineMode) {
    btnPlayOffline.click();
  } else {
    initGame();
  }
});

// Launch the Game
resetToLobby();
