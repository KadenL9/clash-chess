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


    def flip_board(self):
        '''Flip board when switching between turns'''
        new_board = []
        for x in range(7, -1, -1):
            row = []
            for y in range(7, -1, -1):
                row.append(self.board[x][y])
            
            new_board.append(row)
        
        self.board = new_board

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


    def has_piece(self, x, y):
        '''Returns bool which determines if a piece occupies the square or not'''
        return self.board[x][y] == Piece
    

    def pawn_possible_moves(self, x, y):
        '''Checks front for open square, diagonal squares for pieces, and en passant'''
        available_moves = []
        # empty space, able to move to
        if not self.has_piece(x - 1, y):
            available_moves.append((x - 1, y))
        
        # left diagonal, opponent piece needs to exist
        if y != 0 and self.has_piece(x - 1, y - 1) and self.board[x - 1][y - 1].get_player() != self.currplayer:
            available_moves.append((x - 1, y - 1))

        # right diagonal, opponent piece needs to exist
        if y != 7 and self.has_piece(x - 1, y + 1) and self.board[x - 1][y + 1].get_player() != self.currplayer:
            available_moves.append((x - 1, y + 1))

        return available_moves

    
    def bishop_possible_moves(self, x, y):
        '''Check diagonals'''
        available_moves = []

        # top left direction
        xtl = x
        ytl = y
        while xtl > 0 and ytl > 0:
            if self.has_piece(xtl - 1, ytl - 1):
                if self.board[xtl - 1][ytl - 1].get_player() != self.currplayer:
                    available_moves.append((xtl - 1, ytl - 1))
                    
                break
            else:
                available_moves.append(xtl - 1, ytl - 1)

            xtl -= 1
            ytl -= 1

        
        # top right direction
        xtr = x
        ytr = y
        while xtr > 0 and ytr < 7:
            if self.has_piece(xtr - 1, ytr + 1):
                if self.board[xtr - 1][ytr + 1].get_player() != self.currplayer:
                    available_moves.append((xtr - 1, ytr + 1))

                break
            else:
                available_moves.append((xtr - 1, ytr + 1))
            
            xtr -= 1
            ytr += 1
    
        # bottom left direction
        xbl = x
        ybl = y
        while xbl < 7 and ybl > 0:
            if self.has_piece(xbl + 1, ybl - 1):
                if self.board[xbl + 1][ybl - 1].get_player() != self.currplayer:
                    available_moves.append((xbl + 1, ybl - 1))
                
                break
            else:
                available_moves.append((xbl + 1, ybl - 1))
            
            xbl += 1
            ybl -= 1

        # bottom right direction
        xbr = x
        ybr = y
        while xbr < 7 and ybr < 7:
            if self.has_piece(xbr + 1, ybr + 1):
                if self.board[xbr + 1][ybr + 1].get_player() != self.currplayer:
                    available_moves.append((xbr + 1, ybr + 1))
                
                break
            else:
                available_moves.append((xbr + 1, ybr + 1))
            
            xbr += 1
            ybr += 1

        return available_moves


    def knight_possible_moves(self, x, y):
        '''Check all Ls'''
        available_moves = []

        # top Ls
        if x >= 2:
            if y > 0 and (not self.has_piece(x - 2, y - 1) or self.board[x - 2][y - 1].get_player() != self.currplayer):
                available_moves.append(x - 2, y - 1)
            if y < 7 and (not self.has_piece(x - 2, y + 1) or self.board[x - 2][y + 1].get_player() != self.currplayer):
                available_moves.append(x - 2, y + 1)
        
        # bottom Ls
        if x <= 5:
            if y > 0 and (not self.has_piece(x + 2, y - 1) or self.board[x + 2][y - 1].get_player() != self.currplayer):
                available_moves.append(x + 2, y - 1)
            if y < 7 and (not self.has_piece(x + 2, y + 1) or self.board[x + 2][y + 1].get_player() != self.currplayer):
                available_moves.append(x + 2, y + 1)

        # left Ls
        if y >= 2:
            if x > 0 and (not self.has_piece(x - 1, y - 2) or self.board[x - 1][y - 2].get_player() != self.currplayer):
                available_moves.append(x - 1, y - 2)
            if x < 7 and (not self.has_piece(x + 1, y - 2) or self.board[x + 1][y - 2].get_player() != self.currplayer):
                available_moves.append(x + 1, y - 2)
        
        # right Ls
        if y <= 5:
            if x > 0 and (not self.has_piece(x - 1, y + 2) or self.board[x - 1][y + 2].get_player() != self.currplayer):
                available_moves.append(x - 1, y + 2)
            if x < 7 and (not self.has_piece(x + 1, y + 2) or self.board[x + 1][y + 2].get_player() != self.currplayer):
                available_moves.append(x + 1, y + 2)

        return available_moves

    def rook_possible_moves(self, x, y):
        '''Check horizontals and verticals'''
        available_moves = []

        xu = x
        # up direction
        while xu > 0:
            if self.has_piece(xu - 1, y):
                if self.board[xu - 1][y].get_player() != self.currplayer:
                    available_moves.append((xu - 1, y))

                break
            else:
                available_moves.append((xu - 1, y))

            xu -= 1
        
        # down direction
        xd = x
        while xd < 7:
            if self.has_piece(xd + 1, y):
                if self.board[xd + 1][y].get_player() != self.currplayer:
                    available_moves.append((xd + 1, y))
                
                break
            else:
                available_moves.append((xd + 1, y))
            
            xd += 1

        # left direction
        yl = y
        while yl > 0:
            if self.has_piece(x, yl - 1):
                if self.board[x][yl - 1].get_player() != self.currplayer:
                    available_moves.append((x, yl - 1))
                
                break
            else:
                available_moves.append((x, yl - 1))

            yl -= 1

        # right direction
        yr = y
        while yr < 7:
            if self.has_piece(x, yr + 1):
                if self.board[x][yr + 1].get_player() != self.currplayer:
                    available_moves.append((x, yr + 1))
                
                break
            else:
                available_moves.append((x, yr - 1))
            
            yr += 1


        return available_moves
    
    def queen_possible_moves(self, x, y):
        '''Check diagonals, horizontals, and verticals'''
        available_moves = self.bishop_possible_moves(x, y) + self.rook_possible_moves(x, y)

        return available_moves


    def king_possible_moves(self, x, y):
        '''Check all directions in 1 square radius, including possible checks'''
        available_moves = []

        return available_moves
