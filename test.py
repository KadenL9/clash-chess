from gamestate import GameState

gs = GameState()
gs.board = [[x + y for x in range(8)] for y in range(8)]

for x in range(8):
    print(gs.board[x])

gs.flip_board()
print()

for x in range(8):
    print(gs.board[x])