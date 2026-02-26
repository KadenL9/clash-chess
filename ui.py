import arcade
from arcade import Sprite, SpriteList
from gamestate import GameState


WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 720
WINDOW_TITLE = "Clash x Chess"

BOARD_X = WINDOW_WIDTH / 2 - (64 * 4) + 32
BOARD_Y = WINDOW_HEIGHT / 2 - (64 * 4) + 32

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
    "lb_tile": "images/light_brown_tile.png",
    "shop_title": "images/shop_title.png",
    "dot": "images/dot.png" 
}
black_bishop_texture = arcade.load_texture("images/black_bishop.png")

class GameUI(arcade.Window):
    def __init__(self):
        super().__init__(WINDOW_WIDTH, WINDOW_HEIGHT, WINDOW_TITLE)
        self.background_color = arcade.csscolor.THISTLE

        # initialize GameState
        self.gamestate = GameState()

        # SpriteList for available moves
        self.available_move_sprites = SpriteList()
    

    def setup(self):
        pass


    def on_draw(self):
        self.clear()
     
        sprite_list = SpriteList()

        # draw title 
        # placeholder title for now, will use custom png or something later on
        title = arcade.Text("CLASH X CHESS (placeholder)", WINDOW_WIDTH // 2 - 200, WINDOW_HEIGHT - 80, arcade.color.BLACK, 40)
        title.draw()

        # add in other sprites from helper functions
        sprite_list.extend(self.get_board_sprites())
        sprite_list.extend(self.get_piece_sprites())
        sprite_list.extend(self.get_shop_sprites())

        # available moves
        sprite_list.extend(self.available_move_sprites)

        # shop_title
        """shop_title = arcade.Sprite(images["shop_title"], 0.125)
        shop_title.center_x = WINDOW_WIDTH // 2
        shop_title.center_y = WINDOW_HEIGHT // 2 + 256
        sprite_list.append(shop_title)"""

        # draw all sprites
        sprite_list.draw()

        # shop stuff
        shop_title = arcade.Text("PIECES SHOP (placeholder)", WINDOW_WIDTH // 2 + 350, WINDOW_HEIGHT // 2 + 192, arcade.color.BLACK, 30)
        shop_title.draw()
    

    def get_board_sprites(self):
        '''Return SpriteList for drawing the chess board'''
        board_list = SpriteList()

        alternate = 0
        x_coord = BOARD_X
        for x in range(8):
            y_coord = BOARD_Y
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

        x_coord = BOARD_X
        for x in range(8):
            y_coord = BOARD_Y
            for y in range(8):
                if not self.gamestate.has_piece(x, y):
                    continue

                color = 'b' if self.gamestate.get_board()[x][y].get_player() else 'w'
                piecetype = self.gamestate.get_board()[x][y].get_piecetype()

                piece = Sprite(images[color + "_" + piecetype], 0.4)
                piece.center_x = x_coord + (x * 64)
                piece.center_y = y_coord + (y * 64)

                piece_list.append(piece)
        
        return piece_list
    
    
    def get_shop_sprites(self):
        '''Return SpriteList of sprites in the shop'''
        shop_list = SpriteList()

        # set color based on the player
        color = 'b' if self.gamestate.get_currplayer() else 'w'

        # pawn
        shop_pawn = Sprite(images[color + "_pawn"], 0.4)
        shop_pawn.center_x = WINDOW_WIDTH // 2 + 64 * 6
        shop_pawn.center_y = WINDOW_HEIGHT // 2 + 128
        shop_list.append(shop_pawn)

        # bishop
        shop_bishop = Sprite(images[color + "_bishop"], 0.4)
        shop_bishop.center_x = WINDOW_WIDTH // 2 + 64 * 8
        shop_bishop.center_y = WINDOW_HEIGHT // 2 + 128
        shop_list.append(shop_bishop)

        # knight
        shop_knight = Sprite(images[color + "_knight"], 0.4)
        shop_knight.center_x = WINDOW_WIDTH // 2 + 64 * 6
        shop_knight.center_y = WINDOW_HEIGHT // 2
        shop_list.append(shop_knight)

        # rook
        shop_rook = Sprite(images[color + "_rook"], 0.4)
        shop_rook.center_x = WINDOW_WIDTH // 2 + 64 * 8
        shop_rook.center_y = WINDOW_HEIGHT // 2
        shop_list.append(shop_rook)

        # queen
        shop_queen = Sprite(images[color + "_queen"], 0.4)
        shop_queen.center_x = WINDOW_WIDTH // 2 + 64 * 7
        shop_queen.center_y = WINDOW_HEIGHT // 2 - 128
        shop_list.append(shop_queen)

        return shop_list
    

    def on_mouse_press(self, x, y, button, modifiers):
        '''Called when mouse button is pressed'''
        if button != arcade.MOUSE_BUTTON_LEFT:
            return
        
        self.available_move_sprites.clear()

        # check if player is clicking on a piece on the board and show available moves
        if (BOARD_X < x + 32 < BOARD_X + (64 * 8)) and (BOARD_Y < y + 32 < BOARD_Y + (64 * 8)):
            # obtain the index in the 2-d table
            norm_x = x + 32 - BOARD_X
            norm_y = y + 32 - BOARD_Y

            # actual coords
            board_x = int(norm_x // 64)
            board_y = int(norm_y // 64)

            if self.gamestate.has_piece(board_x, board_y) and self.gamestate.get_currplayer() == self.gamestate.get_piece(board_x, board_y).get_player():
                possible_moves = self.gamestate.get_possible_moves(board_x, board_y)

                if not possible_moves:
                    print("no possible moves")
                    return

                for ax, ay in possible_moves:
                    dot = Sprite(images["dot"])
                    dot.center_x = BOARD_X + (64 * ax)
                    dot.center_y = BOARD_Y + (64 * ay)

                    self.available_move_sprites.append(dot)



        
