from piece import Piece

class GameState:
    def __init__(self):
        '''
            board: contains the 2-D array of pieces that represents the board
            currplayer: which players turn it is (always start with player 0)
        '''
        self.board = None
        self.currplayer = 0

        self.initialize_board()

    
    def get_board(self):
        return self.board
    
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
            pass
        elif type(piece) == "bishop":
            pass
        elif type(piece) == "knight":
            pass
        elif type(piece) == "rook":
            pass
        elif type(piece) == "queen":
            pass
        elif type(piece) == "king":
            pass