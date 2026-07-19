import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Chess } from 'chess.js';
import * as db from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

// Health Check for Render.com
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Authentication & Stats HTTP APIs
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, reason: 'Username and password are required.' });
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 15) {
    return res.status(400).json({ success: false, reason: 'Username must be between 3 and 15 characters.' });
  }
  try {
    const result = await db.registerUser(trimmed, password);
    if (result.success) {
      return res.json({ success: true });
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    return res.status(500).json({ success: false, reason: 'Internal error during registration.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, reason: 'Username and password are required.' });
  }
  try {
    const result = await db.loginUser(username, password);
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    return res.status(500).json({ success: false, reason: 'Internal error during login.' });
  }
});

app.get('/api/stats/:username', async (req, res) => {
  try {
    const statsData = await db.fetchUserStats(req.params.username);
    if (!statsData) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(statsData);
  } catch (err) {
    return res.status(500).json({ error: 'Internal error fetching stats.' });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game state variables
const rooms = {};

const ELIXIR_COSTS = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const getSquareName = (x, y) => FILES[x] + (y + 1);
const parseSquareName = (square) => {
  const x = square.charCodeAt(0) - 97;
  const y = parseInt(square[1]) - 1;
  return { x, y };
};

// Helper starting square verification
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

// Generate room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Associate socket connection with authenticated user
  socket.on('register_socket_user', ({ username }) => {
    socket.username = username;
    console.log(`Socket ${socket.id} associated with username: ${username}`);
  });

  // 1. Create Lobby Room
  socket.on('create_room', () => {
    let roomId = generateRoomCode();
    while (rooms[roomId]) {
      roomId = generateRoomCode();
    }

    const chessInstance = new Chess();
    chessInstance.clear();
    chessInstance.put({ type: 'k', color: 'w' }, 'e1');
    chessInstance.put({ type: 'k', color: 'b' }, 'e8');

    // Force starting turn as White
    const fenParts = chessInstance.fen().split(' ');
    fenParts[1] = 'w';
    chessInstance.load(fenParts.join(' '));

    rooms[roomId] = {
      roomId,
      chess: chessInstance,
      players: { w: socket.id, b: null },
      playerNames: { w: socket.username || 'Anonymous', b: null },
      playerElixirs: { w: 2, b: 0 } // White starts with 2 elixir
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerColor = 'w';

    console.log(`Room created: ${roomId} by ${socket.id} (username: ${socket.username || 'Anonymous'})`);
    socket.emit('room_created', { roomId, yourColor: 'w' });
  });

  // 2. Join Lobby Room
  socket.on('join_room', ({ roomId }) => {
    const code = roomId.toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      socket.emit('join_error', { reason: 'Lobby not found. Check your code!' });
      return;
    }

    if (room.players.b) {
      socket.emit('join_error', { reason: 'This game lobby is full.' });
      return;
    }

    const creatorId = room.players.w;
    const joinerId = socket.id;

    // Randomize player color assignments (White/Black)
    const creatorColor = Math.random() < 0.5 ? 'w' : 'b';
    const joinerColor = creatorColor === 'w' ? 'b' : 'w';

    room.players = {
      w: creatorColor === 'w' ? creatorId : joinerId,
      b: creatorColor === 'b' ? creatorId : joinerId
    };

    const creatorName = room.playerNames.w;
    const joinerName = socket.username || 'Anonymous';
    room.playerNames = {
      w: creatorColor === 'w' ? creatorName : joinerName,
      b: creatorColor === 'b' ? creatorName : joinerName
    };

    socket.join(code);
    socket.roomId = code;

    // Update socket metadata colors
    const creatorSocket = io.sockets.sockets.get(creatorId);
    if (creatorSocket) creatorSocket.playerColor = creatorColor;
    socket.playerColor = joinerColor;

    console.log(`Room ${code} starting: Creator=${creatorColor} (${creatorName}), Joiner=${joinerColor} (${joinerName})`);
    
    // Notify both players individually of their assigned color
    io.to(creatorId).emit('room_joined', {
      roomId: code,
      yourColor: creatorColor
    });

    io.to(joinerId).emit('room_joined', {
      roomId: code,
      yourColor: joinerColor
    });

    // Send initial board state payload
    sendState(code);
  });

  // 3. Move Pieces
  socket.on('make_move', ({ from, to }) => {
    const code = socket.roomId;
    const room = rooms[code];
    if (!room) {
      console.log(`make_move error: room ${code} not found`);
      return;
    }

    const chessInstance = room.chess;
    const turn = chessInstance.turn();

    console.log(`make_move: room=${code}, turn=${turn}, expectedSocket=${room.players[turn]}, actualSocket=${socket.id}`);

    // Verify turn order
    if (room.players[turn] !== socket.id) {
      socket.emit('invalid_action', { reason: "It's not your turn!" });
      return;
    }

    try {
      const move = chessInstance.move({ from, to, promotion: 'q' });
      if (move) {
        // Toggle turn and award elixir to the next player
        switchTurn(code);
      } else {
        socket.emit('invalid_action', { reason: 'Illegal chess move.' });
      }
    } catch (err) {
      socket.emit('invalid_action', { reason: 'Invalid chess move.' });
    }
  });

  // 4. Place Shop Pieces
  socket.on('spawn_piece', ({ piece, to }) => {
    const code = socket.roomId;
    const room = rooms[code];
    if (!room) {
      console.log(`spawn_piece error: room ${code} not found`);
      return;
    }

    const chessInstance = room.chess;
    const turn = chessInstance.turn();

    console.log(`spawn_piece: room=${code}, turn=${turn}, expectedSocket=${room.players[turn]}, actualSocket=${socket.id}`);

    if (room.players[turn] !== socket.id) {
      socket.emit('invalid_action', { reason: "It's not your turn!" });
      return;
    }

    const cost = ELIXIR_COSTS[piece];
    if (room.playerElixirs[turn] < cost) {
      socket.emit('invalid_action', { reason: 'Not enough Elixir!' });
      return;
    }

    const { x, y } = parseSquareName(to);
    if (!isClassicStartingSquare(piece, turn, x, y)) {
      socket.emit('invalid_action', { reason: 'Must place on classic starting squares.' });
      return;
    }

    if (chessInstance.get(to)) {
      socket.emit('invalid_action', { reason: 'Target square is occupied.' });
      return;
    }

    try {
      const typeMap = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q' };
      chessInstance.put({ type: typeMap[piece], color: turn }, to);

      // Spend elixir
      room.playerElixirs[turn] -= cost;

      // Toggle turn manually in chess.js
      const fenParts = chessInstance.fen().split(' ');
      fenParts[1] = turn === 'w' ? 'b' : 'w';
      fenParts[3] = '-'; // Clear en-passant
      chessInstance.load(fenParts.join(' '));

      switchTurn(code);
    } catch (err) {
      console.error(err);
      socket.emit('invalid_action', { reason: 'Error placing piece.' });
    }
  });

  // 5. Player Disconnects
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const code = socket.roomId;
    const room = rooms[code];

    if (room) {
      // Notify the opponent
      socket.to(code).emit('opponent_disconnected', { reason: 'Your opponent left the game lobby.' });
      
      // Clean up room state
      delete rooms[code];
      console.log(`Cleaned up Room ${code}`);
    }
  });
});

function switchTurn(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const nextTurn = room.chess.turn();
  room.playerElixirs[nextTurn] += 2; // Uncapped elixir accumulation

  sendState(roomId);
}

function sendState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const chessInstance = room.chess;
  const turn = chessInstance.turn();
  const elixir = room.playerElixirs[turn];

  const inCheck = chessInstance.inCheck();
  const hasChessMoves = chessInstance.moves().length > 0;
  const canPlace = canPlaceAnyPiece(chessInstance, elixir, turn);

  let gameStatus = 'active'; // 'active', 'checkmate', 'stalemate'
  let winner = null;

  if (inCheck && !hasChessMoves) {
    const canEscape = canEscapeCheckByPlacement(chessInstance, elixir, turn);
    if (!canEscape) {
      gameStatus = 'checkmate';
      winner = turn === 'w' ? 'b' : 'w';
    }
  } else if (!inCheck && !hasChessMoves && !canPlace) {
    gameStatus = 'stalemate';
  }

  // Record stats once when game resolves
  if (gameStatus !== 'active' && !room.statsRecorded) {
    room.statsRecorded = true;
    const whiteUser = room.playerNames ? room.playerNames.w : 'Anonymous';
    const blackUser = room.playerNames ? room.playerNames.b : 'Anonymous';

    if (gameStatus === 'checkmate') {
      if (whiteUser && whiteUser !== 'Anonymous') {
        db.recordGameResult(whiteUser, winner === 'w' ? 'win' : 'loss');
      }
      if (blackUser && blackUser !== 'Anonymous') {
        db.recordGameResult(blackUser, winner === 'b' ? 'win' : 'loss');
      }
    } else if (gameStatus === 'stalemate') {
      if (whiteUser && whiteUser !== 'Anonymous') db.recordGameResult(whiteUser, 'draw');
      if (blackUser && blackUser !== 'Anonymous') db.recordGameResult(blackUser, 'draw');
    }
  }

  io.to(roomId).emit('game_state_update', {
    fen: chessInstance.fen(),
    turn,
    whiteElixir: room.playerElixirs.w,
    blackElixir: room.playerElixirs.b,
    gameStatus,
    winner,
    playerNames: room.playerNames || { w: 'Anonymous', b: 'Anonymous' }
  });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Clash Chess backend server listening on port ${PORT}`);
});
