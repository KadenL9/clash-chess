import arcade
from arcade import Sprite, SpriteList
from gamestate import GameState


WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 720
WINDOW_TITLE = "Clash x Chess"

# image files
images = {
    "b_bishop": "images/black_bishop.png",
    "b_king" : "images/black_king.png",
    "b_knight": "images/black_knight.png",
    "b_pawn": "images/black_pawn.png",
    "b_queen": "images/black_queen.png",
    "b_rook": "images/black_rook.png",
    "w_bishop": "images/white_bishop.png",
    "w_king": "images/white_king.png",
    "w_knight": "images/white_knight.png",
    "w_pawn": "images/white_pawn.png",
    "w_queen": "images/white_queen.png",
    "w_rook": "images/white_rook.png",
    "db_tile": "images/dark_brown_tile.png",
    "lb_tile": "images/light_brown_tile.png"
}
black_bishop_texture = arcade.load_texture("images/black_bishop.png")

class GameUI(arcade.Window):
    def __init__(self):
        super().__init__(WINDOW_WIDTH, WINDOW_HEIGHT, WINDOW_TITLE)
        self.background_color = arcade.csscolor.ALICE_BLUE

        # initialize GameState
        self.gamestate = GameState()
    
    def setup(self):
        pass

    def on_draw(self):
        self.clear()

        sprite_list = SpriteList()
        sprite_list.extend(self.get_board_sprites())
        sprite_list.extend(self.get_piece_sprites())
        sprite_list.draw()
    

    def get_board_sprites(self):
        '''Return SpriteList for drawing the chess board'''
        board_list = SpriteList()

        alternate = 0
        x_coord = 100
        for x in range(8):
            y_coord = 100
            for y in range(8):
                tile_color = "db_tile"
                if alternate:
                    tile_color = "lb_tile"

                tile = Sprite(images[tile_color], 0.5)
                tile.center_x = x_coord + (x * 64)
                tile.center_y = y_coord + (y * 64)

                board_list.append(tile)

                alternate = not alternate
            alternate = not alternate
        
        return board_list

    def get_piece_sprites(self):
        '''Return SpriteList of pieces on the board'''
        piece_list = SpriteList()

        x_coord = 100
        for x in range(8):
            y_coord = 100
            for y in range(8):
                if not self.gamestate.has_piece(7 - x, y):
                    continue

                color = 'b' if self.gamestate.get_board()[7 - x][y].get_player() else 'w'
                piecetype = self.gamestate.get_board()[7 - x][y].get_piecetype()

                piece = Sprite(images[color + "_" + piecetype], 0.4)
                piece.center_x = x_coord + (x * 64)
                piece.center_y = y_coord + (y * 64)

                piece_list.append(piece)
        
        return piece_list
