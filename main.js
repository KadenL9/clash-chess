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

// Determine server URL dynamically (Render URL or localhost)
const DEV_SERVER_URL = "http://localhost:3000";
const PROD_SERVER_URL = "https://clash-chess-backend.onrender.com"; // Deploy backend to Render, then replace this url if different
const SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? DEV_SERVER_URL 
  : PROD_SERVER_URL;

console.log(`Connecting to backend server at: ${SERVER_URL}`);
const socket = io(SERVER_URL, { autoConnect: false });

// Game State variables
let chess = new Chess();
let playerElixirs = { w: 2, b: 0 };
let myColor = null;                 // 'w' or 'b' (assigned on join)
let activeTurn = 'w';               // 'w' or 'b'
let selectedTile = null;            // {x, y}
let selectedShopPiece = null;       // 'pawn', 'knight', etc.
let dragSource = null;              // {source: 'board'/'shop', x, y, piece}
let availableMoves = [];            // Array of square names
let placementSquares = [];          // Array of square names

// DOM Elements
const lobbySetup = document.getElementById('lobby-setup');
const lobbyWaiting = document.getElementById('lobby-waiting');
const gameBoardContainer = document.getElementById('game-board-container');
const lobbyStatus = document.getElementById('lobby-status');
const roomCodeDisplay = document.getElementById('room-code-display');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
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

// --- 1. LOBBY MATCHMAKING INTERACTION HANDLERS ---

// Connect and trigger action helper
function connectSocket(callback) {
  if (!socket.connected) {
    lobbyStatus.innerText = "Connecting to server (waking up Render instance)...";
    socket.connect();
    
    socket.once('connect', () => {
      lobbyStatus.innerText = "Server Connected.";
      callback();
    });

    socket.once('connect_error', () => {
      lobbyStatus.innerText = "Connection failed. Backend server may be starting up, please try again in a few seconds!";
    });
  } else {
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

// Cancel Waiting / Leave Lobby
btnCancelRoom.addEventListener('click', () => {
  socket.disconnect();
  resetToLobby();
});

// Leave active game board
btnRestart.addEventListener('click', () => {
  if (confirm("Are you sure you want to leave the game room?")) {
    socket.disconnect();
    resetToLobby();
  }
});

btnOverlayRestart.addEventListener('click', () => {
  hideGameOver();
  socket.disconnect();
  resetToLobby();
});

function resetToLobby() {
  myColor = null;
  selectedTile = null;
  selectedShopPiece = null;
  dragSource = null;
  availableMoves = [];
  placementSquares = [];
  
  gameBoardContainer.classList.add('hidden');
  lobbyWaiting.classList.add('hidden');
  lobbySetup.classList.remove('lobby-setup-container', 'hidden');
  lobbySetup.classList.add('lobby-setup-container');
  lobbyStatus.innerText = socket.connected ? "Ready to host or join." : "Server disconnected.";
}

// --- 2. WEBSOCKET STATE SYNCHRONIZATION ---

socket.on('room_created', ({ roomId, yourColor }) => {
  console.log(`Room created: ${roomId}, assigned: ${yourColor}`);
  myColor = yourColor;
  lobbySetup.classList.add('hidden');
  lobbyWaiting.classList.remove('hidden');
  roomCodeDisplay.innerText = roomId;
});

socket.on('room_joined', ({ roomId, whitePlayerId, blackPlayerId }) => {
  console.log(`Match started inside Room ${roomId}`);
  
  // Assign Color to joiner (if they don't already have it)
  if (!myColor) {
    myColor = 'b';
  }

  lobbySetup.classList.add('hidden');
  lobbyWaiting.classList.add('hidden');
  gameBoardContainer.classList.remove('hidden');
});

socket.on('game_state_update', ({ fen, turn, whiteElixir, blackElixir, gameStatus, winner }) => {
  console.log(`State update: turn=${turn}, elixirs=W:${whiteElixir} B:${blackElixir}`);
  
  // Load canonical chess board state
  chess.load(fen);
  activeTurn = turn;
  playerElixirs = { w: whiteElixir, b: blackElixir };

  updateUI();

  // Handle Game Overs
  if (gameStatus === 'checkmate') {
    const winnerName = winner === 'w' ? 'White' : 'Black';
    showGameOver('CHECKMATE!', `${winnerName} Player Wins!`);
  } else if (gameStatus === 'stalemate') {
    showGameOver('STALEMATE!', 'Draw Game');
  }
});

socket.on('invalid_action', ({ reason }) => {
  alert(reason);
  // Re-sync UI state
  updateUI();
});

socket.on('opponent_disconnected', ({ reason }) => {
  alert(reason);
  socket.disconnect();
  resetToLobby();
});

// --- 3. CLASSIC STARTING SQUARE VALIDATION (CLIENT-SIDE VISUALS) ---

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

// --- 4. GAME UI DRAWING AND BOARD RENDERING ---

function updateUI() {
  const turn = activeTurn;
  
  // Update Turn title announcement
  let announcement = `${turn === 'w' ? 'White' : 'Black'}'s Turn`;
  if (myColor) {
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

    // Only allow interaction if it's our turn AND we have enough elixir
    if (myColor === turn && playerElixirs[turn] >= cost) {
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
  boardEl.innerHTML = '';

  for (let y = 7; y >= 0; y--) {
    for (let x = 0; x < 8; x++) {
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
        // Skip drawing the piece if it is being dragged so it doesn't double-draw
        const isDraggedBoardPiece = (dragSource && dragSource.source === 'board' && dragSource.x === x && dragSource.y === y);
        if (!isDraggedBoardPiece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
          pieceEl.innerText = PIECE_SYMBOLS[piece.color][piece.type];
          pieceEl.setAttribute('draggable', 'true');
          
          // Disable dragging opponent's pieces OR dragging when it's not our turn
          if (piece.color !== myColor || activeTurn !== myColor) {
            pieceEl.style.cursor = 'not-allowed';
            pieceEl.setAttribute('draggable', 'false');
          }

          // HTML5 Drag Handlers for pieces
          pieceEl.addEventListener('dragstart', (e) => {
            if (piece.color !== myColor || activeTurn !== myColor) {
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
            socket.emit('make_move', { from: fromSquare, to: targetSquare });
          }
        } else if (dragSource.source === 'shop') {
          if (placementSquares.includes(targetSquare)) {
            socket.emit('spawn_piece', { piece: dragSource.piece, to: targetSquare });
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

        // Check if user is clicking on an active overlay square
        if (availableMoves.includes(square) && selectedTile) {
          socket.emit('make_move', { from: getSquareName(selectedTile.x, selectedTile.y), to: square });
          selectedTile = null;
          updateUI();
          return;
        }

        if (placementSquares.includes(square) && selectedShopPiece) {
          socket.emit('spawn_piece', { piece: selectedShopPiece, to: square });
          selectedShopPiece = null;
          updateUI();
          return;
        }

        // Standard select clicks (only allowed if it's our piece AND our turn)
        if (activeTurn === myColor && piece && piece.color === myColor) {
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

    if (myColor !== turn || playerElixirs[turn] < cost) {
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

    if (myColor === turn && playerElixirs[turn] >= cost) {
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

// Initial Local Setup
resetToLobby();
