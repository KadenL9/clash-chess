class Piece:
    def __init__(self, player, x, y, piecetype):
        ''' 
            player: denotes which player the piece belongs to (0 or 1)
            x: x-coordinate on the board
            y: y-coordinate on the board
            piecetype: type of piece (e.g. pawn, king, queen)
        '''
        self.player = player
        self.x = x
        self.y = y
        self.piecetype = piecetype

    
    def get_player(self):
        return self.player

    def get_coords(self):
        return (self.x, self.y)
    
    def get_piecetype(self):
        return self.piecetype
    