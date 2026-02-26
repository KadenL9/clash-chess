from piece import Piece
from player import Player

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
        self.whiteplayer = Player(0)
        self.blackplayer = Player(1)

        self.initialize_board()

    
    def get_board(self):
        return self.board
    

    def get_piece(self, x, y):
        return self.board[x][y]
    
    def get_currplayer(self):
        return self.currplayer
    

    def initialize_board(self):
        '''Initialize the starting board with only the king pieces'''
        self.board = [[None for x in range(8)] for y in range(8)]
        
        white_king = Piece(0, 0, 0, "king")
        black_king = Piece(1, 7, 7, "king")

        self.board[0][0] = white_king
        self.board[7][7] = black_king


    def flip_board(self):
        '''Flip board when switching between turns'''
        new_board = []
        for x in range(7, -1, -1):
            row = []
            for y in range(7, -1, -1):
                row.append(self.board[x][y])
            
            new_board.append(row)
        
        self.board = new_board

    
    def add_piece(self, piecetype, x, y):
        '''Add the piece to the board in the given (x, y) space'''
        self.board[x][y] = Piece(self.currplayer, x, y, piecetype)

    
    def move_piece(self, x, y, new_x, new_y):
        '''Move the piece to the new space'''
        self.board[new_x][new_y] = self.board[x][y]
        self.board[x][y] = None


    def get_possible_moves(self, x, y):
        '''Get possible moves for the piece at (x, y)'''
        piece = self.board[x][y]
        print(type(piece))
            
        # if for some reason we don't have a piece or its None
        if type(piece) != Piece:
            return []
        elif piece.get_piecetype() == "pawn":
            return self.pawn_possible_moves(x, y)
        elif piece.get_piecetype() == "bishop":
            return self.bishop_possible_moves(x, y)
        elif piece.get_piecetype() == "knight":
            return self.knight_possible_moves(x, y)
        elif piece.get_piecetype() == "rook":
            return self.rook_possible_moves(x, y)
        elif piece.get_piecetype() == "queen":
            return self.queen_possible_moves(x, y)
        elif piece.get_piecetype() == "king":
            return self.king_possible_moves(x, y)
        else:
            return []
        

    def has_piece(self, x, y):
        '''Returns bool which determines if a piece occupies the square or not'''
        return type(self.board[x][y]) == Piece
    

    def pawn_possible_moves(self, x, y):
        '''Checks front for open square, diagonal squares for pieces, and en passant'''
        available_moves = []
        # empty space, able to move to
        if not self.has_piece(x, y + 1):
            available_moves.append((x, y + 1))
        
        # left diagonal, opponent piece needs to exist
        if x != 0 and self.has_piece(x - 1, y + 1) and self.board[x - 1][y + 1].get_player() != self.currplayer:
            available_moves.append((x - 1, y + 1))

        # right diagonal, opponent piece needs to exist
        if x != 7 and self.has_piece(x + 1, y + 1) and self.board[x + 1][y + 1].get_player() != self.currplayer:
            available_moves.append((x + 1, y + 1))

        return available_moves

    
    def bishop_possible_moves(self, x, y):
        '''Check diagonals'''
        available_moves = []

        # top left direction
        xtl = x
        ytl = y
        while xtl > 0 and ytl < 7:
            if self.has_piece(xtl - 1, ytl + 1):
                if self.board[xtl - 1][ytl + 1].get_player() != self.currplayer:
                    available_moves.append((xtl - 1, ytl + 1))
                    
                break
            else:
                available_moves.append((xtl - 1, ytl + 1))

            xtl -= 1
            ytl += 1

        
        # top right direction
        xtr = x
        ytr = y
        while xtr < 7 and ytr < 7:
            if self.has_piece(xtr + 1, ytr + 1):
                if self.board[xtr + 1][ytr + 1].get_player() != self.currplayer:
                    available_moves.append((xtr + 1, ytr + 1))

                break
            else:
                available_moves.append((xtr + 1, ytr + 1))
            
            xtr += 1
            ytr += 1
    
        # bottom left direction
        xbl = x
        ybl = y
        while xbl > 0 and ybl > 0:
            if self.has_piece(xbl - 1, ybl - 1):
                if self.board[xbl - 1][ybl - 1].get_player() != self.currplayer:
                    available_moves.append((xbl - 1, ybl - 1))
                
                break
            else:
                available_moves.append((xbl - 1, ybl - 1))
            
            xbl -= 1
            ybl -= 1

        # bottom right direction
        xbr = x
        ybr = y
        while xbr < 7 and ybr > 0:
            if self.has_piece(xbr + 1, ybr - 1):
                if self.board[xbr + 1][ybr - 1].get_player() != self.currplayer:
                    available_moves.append((xbr + 1, ybr - 1))
                
                break
            else:
                available_moves.append((xbr + 1, ybr - 1))
            
            xbr += 1
            ybr -= 1

        return available_moves


    def knight_possible_moves(self, x, y):
        '''Check all Ls'''
        available_moves = []

        # left Ls
        if x >= 2:
            if y > 0 and (not self.has_piece(x - 2, y - 1) or self.board[x - 2][y - 1].get_player() != self.currplayer):
                available_moves.append(x - 2, y - 1)
            if y < 7 and (not self.has_piece(x - 2, y + 1) or self.board[x - 2][y + 1].get_player() != self.currplayer):
                available_moves.append(x - 2, y + 1)
        
        # right Ls
        if x <= 5:
            if y > 0 and (not self.has_piece(x + 2, y - 1) or self.board[x + 2][y - 1].get_player() != self.currplayer):
                available_moves.append(x + 2, y - 1)
            if y < 7 and (not self.has_piece(x + 2, y + 1) or self.board[x + 2][y + 1].get_player() != self.currplayer):
                available_moves.append(x + 2, y + 1)

        # bottom Ls
        if y >= 2:
            if x > 0 and (not self.has_piece(x - 1, y - 2) or self.board[x - 1][y - 2].get_player() != self.currplayer):
                available_moves.append(x - 1, y - 2)
            if x < 7 and (not self.has_piece(x + 1, y - 2) or self.board[x + 1][y - 2].get_player() != self.currplayer):
                available_moves.append(x + 1, y - 2)
        
        # top Ls
        if y <= 5:
            if x > 0 and (not self.has_piece(x - 1, y + 2) or self.board[x - 1][y + 2].get_player() != self.currplayer):
                available_moves.append(x - 1, y + 2)
            if x < 7 and (not self.has_piece(x + 1, y + 2) or self.board[x + 1][y + 2].get_player() != self.currplayer):
                available_moves.append(x + 1, y + 2)

        return available_moves

    def rook_possible_moves(self, x, y):
        '''Check horizontals and verticals'''
        available_moves = []

        xl = x
        # left direction
        while xl > 0:
            if self.has_piece(xl - 1, y):
                if self.board[xl - 1][y].get_player() != self.currplayer:
                    available_moves.append((xl - 1, y))

                break
            else:
                available_moves.append((xl - 1, y))

            xl -= 1
        
        # right direction
        xr = x
        while xr < 7:
            if self.has_piece(xr + 1, y):
                if self.board[xr + 1][y].get_player() != self.currplayer:
                    available_moves.append((xr + 1, y))
                
                break
            else:
                available_moves.append((xr + 1, y))
            
            xr += 1

        # down direction
        yd = y
        while yd > 0:
            if self.has_piece(x, yd - 1):
                if self.board[x][yd - 1].get_player() != self.currplayer:
                    available_moves.append((x, yd - 1))
                
                break
            else:
                available_moves.append((x, yd - 1))

            yd -= 1

        # up direction
        yu = y
        while yu < 7:
            if self.has_piece(x, yu + 1):
                if self.board[x][yu + 1].get_player() != self.currplayer:
                    available_moves.append((x, yu + 1))
                
                break
            else:
                available_moves.append((x, yu + 1))
            
            yu += 1


        return available_moves
    
    def queen_possible_moves(self, x, y):
        '''Check diagonals, horizontals, and verticals'''
        available_moves = self.bishop_possible_moves(x, y) + self.rook_possible_moves(x, y)

        return available_moves


    def king_possible_moves(self, x, y):
        '''Check all directions in 1 square radius, including possible checks'''
        available_moves = []

        coords = [(x + 1, y + 1), (x + 1, y), (x + 1, y - 1), (x, y + 1), (x, y - 1), (x - 1, y + 1), (x - 1, y), (x - 1, y - 1)]
        for kx, ky in coords:
            if (0 <= kx <= 7) and (0 <= ky <= 7):
                if self.valid_king_square(kx, ky):
                    available_moves.append((kx, ky))

        return available_moves


    def valid_king_square(self, x, y):
        '''Check square for valid king move'''
        # check diagonals for bishops or queens

        # check horizontals and verticals for queens

        pass