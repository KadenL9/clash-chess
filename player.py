class Player:
    def __init__(self, id):
        '''
            id: represents which player this is for (usually 0 or 1)
            elixir: current elixir count for the player
        '''
        self.id = id
        self.elixir = 0

    
    def get_id(self):
        return self.id
    

    def get_elixir(self):
        return self.elixir
    

    def gain_elixir(self, amt):
        '''Add elixir to the player's elixir count'''
        self.elixir += amt

    
    def spend_elixir(self, amt):
        '''Remove elixir if buying a piece'''
        self.elixir -= amt