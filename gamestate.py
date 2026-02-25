from piece import Piece

class GameState:
    def __init__(self):
        '''
            board: contains the 2-D array of pieces that represents the board
            currplayer: which players turn it is (always start with player 0)
            is_check: determines if there is a check or not
        '''
        self.board = None
        self.currplayer = 0
        self.is_check = False

        self.initialize_board()

    
    def get_board(self):
        return self.board
    
    def get_currplayer(self):
        return self.currplayer
    

    def initialize_board(self):
        '''Initialize the starting board with only the king pieces'''
        self.board = [[None for x in range(8)] for y in range(8)]
        
        white_king = Piece(0, 0, 0, "king")
        black_king = Piece(1, 7, 7, "king")

        self.board[0][0] = white_king
        self.board[7][7] = black_king


    def get_possible_move(self, x, y):
        '''Get possible moves for the piece at (x, y)'''
        piece = self.board[x][y]
            
        # if for some reason we don't have a piece or its None
        if type(piece) != Piece:
            return []
        elif type(piece) == "pawn":
            return self.pawn_possible_moves(x, y)
        elif type(piece) == "bishop":
            return self.bishop_possible_moves(x, y)
        elif type(piece) == "knight":
            return self.knight_possible_moves(x, y)
        elif type(piece) == "rook":
            return self.rook_possible_moves(x, y)
        elif type(piece) == "queen":
            return self.queen_possible_moves(x, y)
        elif type(piece) == "king":
            return self.king_possible_moves(x, y)

    
    def flip_board(self):
        '''Flip board when switching between turns'''
        new_board = []
        for x in range(7, -1, -1):
            row = []
            for y in range(7, -1, -1):
                row.append(self.board[x][y])
            
            new_board.append(row)
        
        self.board = new_board

    
    def pawn_possible_moves(self, x, y):
        '''Checks front for open square, diagonal squares for pieces, and en passant'''
        available_moves = []
        if self.board[x - 1][y] == None:
            available_moves.append((x - 1, y))
        
        if y != 0 and type(self.board[x - 1][y - 1]) == Piece and self.board[x - 1][y - 1].player != self.currplayer:
            available_moves.append((x - 1, y - 1))

        if y != 7 and type(self.board[x - 1][y + 1]) == Piece and self.board[x - 1][y + 1].player != self.currplayer:
            available_moves.append((x - 1, y + 1))

        return available_moves

    
    def bishop_possible_moves(self, x, y):
        '''Check diagonals'''
        available_moves = []

        return available_moves


    def knight_possible_moves(self, x, y):
        '''Check all Ls'''
        available_moves = []

        return available_moves

    def rook_possible_moves(self, x, y):
        '''Check horizontals and verticals'''
        available_moves = []

        return available_moves
    
    def queen_possible_moves(self, x, y):
        '''Check diagonals, horizontals, and verticals'''
        available_moves = []

        return available_moves


    def king_possible_moves(self, x, y):
        '''Check all directions in 1 square radius'''
        available_moves = []

        return available_moves
