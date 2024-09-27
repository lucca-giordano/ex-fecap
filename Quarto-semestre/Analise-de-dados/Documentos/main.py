import pygame
import pygame_gui
import random

pygame.init()

# Dimensões da tela
largura = 600
altura = 400

# Cores padrão da cobra e do fundo
cor_cobra = pygame.Color(0, 0, 0)
cor_fundo = pygame.Color(255, 255, 255)

# Criando a tela do jogo
tela = pygame.display.set_mode((largura, altura))
pygame.display.set_caption('Jogo da Cobrinha')

clock = pygame.time.Clock()

# Tamanho do bloco da cobra e velocidade
tamanho_bloco = 15
velocidade_cobra = 15

# Fontes do jogo
fonte_estilo = pygame.font.SysFont("bahnschrift", 25)
fonte_pontuacao = pygame.font.SysFont("comicsansms", 35)

def sua_pontuacao(pontuacao):
    valor = fonte_pontuacao.render("Pontuação: " + str(pontuacao), True, pygame.Color(0, 0, 255))
    tela.blit(valor, [0, 0])

def nossa_cobra(tamanho_bloco, lista_cobra):
    for x in lista_cobra:
        pygame.draw.rect(tela, cor_cobra, [x[0], x[1], tamanho_bloco, tamanho_bloco])

def mensagem(msg, cor, posicao):
    mesg = fonte_estilo.render(msg, True, cor)
    tela.blit(mesg, posicao)

def menu():
    menu_ativo = True

    # Gerenciador de interface para o menu
    gerenciador_ui_menu = pygame_gui.UIManager((largura, altura))

    botao_iniciar = pygame_gui.elements.UIButton(relative_rect=pygame.Rect((largura/2 - 75, altura/2 - 60), (150, 50)),
                                                 text='Iniciar Jogo',
                                                 manager=gerenciador_ui_menu)
    botao_mudar_cores = pygame_gui.elements.UIButton(relative_rect=pygame.Rect((largura/2 - 75, altura/2), (150, 50)),
                                                     text='Mudar Cores',
                                                     manager=gerenciador_ui_menu)
    botao_sair = pygame_gui.elements.UIButton(relative_rect=pygame.Rect((largura/2 - 75, altura/2 + 60), (150, 50)),
                                              text='Sair do Jogo',
                                              manager=gerenciador_ui_menu)

    while menu_ativo:
        tempo_delta = clock.tick(60)/1000.0
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.USEREVENT:
                if event.user_type == pygame_gui.UI_BUTTON_PRESSED:
                    if event.ui_element == botao_iniciar:
                        gerenciador_ui_menu.clear_and_reset()
                        jogo()
                        menu_ativo = False
                    if event.ui_element == botao_mudar_cores:
                        gerenciador_ui_menu.clear_and_reset()
                        mudar_cores()
                        menu_ativo = False
                    if event.ui_element == botao_sair:
                        pygame.quit()
                        quit()
            gerenciador_ui_menu.process_events(event)

        gerenciador_ui_menu.update(tempo_delta)
        tela.fill(cor_fundo)
        mensagem("Jogo da Cobrinha", pygame.Color(0, 0, 255), [largura / 2 - 100, altura / 2 - 150])
        gerenciador_ui_menu.draw_ui(tela)
        pygame.display.update()

def mudar_cores():
    mudando = True

    # Gerenciador de interface para a mudança de cores
    gerenciador_ui_cores = pygame_gui.UIManager((largura, altura))

    botao_cobra = pygame_gui.elements.UIButton(relative_rect=pygame.Rect((largura/2 - 75, altura/2 - 60), (150, 50)),
                                               text='Cor da Cobra',
                                               manager=gerenciador_ui_cores)
    botao_fundo = pygame_gui.elements.UIButton(relative_rect=pygame.Rect((largura/2 - 75, altura/2), (150, 50)),
                                               text='Cor do Fundo',
                                               manager=gerenciador_ui_cores)
    botao_voltar = pygame_gui.elements.UIButton(relative_rect=pygame.Rect((largura/2 - 75, altura/2 + 60), (150, 50)),
                                                text='Voltar ao Menu',
                                                manager=gerenciador_ui_cores)

    seletor_cobra_aberto = False
    seletor_fundo_aberto = False

    while mudando:
        tempo_delta = clock.tick(60)/1000.0
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()

            if event.type == pygame.USEREVENT:
                if event.user_type == pygame_gui.UI_BUTTON_PRESSED:
                    if event.ui_element == botao_cobra and not seletor_cobra_aberto:
                        seletor_cobra = pygame_gui.windows.UIColourPickerDialog(
                            rect=pygame.Rect((largura/2 - 200, altura/2 - 200), (400, 400)),
                            manager=gerenciador_ui_cores,
                            window_title='Selecione a Cor da Cobra'
                        )
                        seletor_cobra_aberto = True
                    elif event.ui_element == botao_fundo and not seletor_fundo_aberto:
                        seletor_fundo = pygame_gui.windows.UIColourPickerDialog(
                            rect=pygame.Rect((largura/2 - 200, altura/2 - 200), (400, 400)),
                            manager=gerenciador_ui_cores,
                            window_title='Selecione a Cor do Fundo'
                        )
                        seletor_fundo_aberto = True
                    elif event.ui_element == botao_voltar:
                        mudando = False
                        gerenciador_ui_cores.clear_and_reset()
                        menu()
                elif event.user_type == pygame_gui.UI_COLOUR_PICKER_COLOUR_PICKED:
                    if event.ui_element.window_title == 'Selecione a Cor da Cobra':
                        global cor_cobra
                        cor_cobra = event.ui_element.current_colour
                        seletor_cobra_aberto = False
                        event.ui_element.kill()
                    elif event.ui_element.window_title == 'Selecione a Cor do Fundo':
                        global cor_fundo
                        cor_fundo = event.ui_element.current_colour
                        seletor_fundo_aberto = False
                        event.ui_element.kill()
                elif event.user_type == pygame_gui.UI_WINDOW_CLOSE:
                    if event.ui_element.window_title == 'Selecione a Cor da Cobra':
                        seletor_cobra_aberto = False
                    elif event.ui_element.window_title == 'Selecione a Cor do Fundo':
                        seletor_fundo_aberto = False

            gerenciador_ui_cores.process_events(event)

        gerenciador_ui_cores.update(tempo_delta)
        tela.fill(cor_fundo)
        mensagem("Mudar Cores", pygame.Color(0, 0, 255), [largura / 2 - 80, altura / 2 - 150])
        gerenciador_ui_cores.draw_ui(tela)
        pygame.display.update()

def jogo():
    game_over = False
    game_close = False

    x1 = largura / 2
    y1 = altura / 2

    x1_mudanca = 0
    y1_mudanca = 0

    lista_cobra = []
    comprimento_cobra = 1

    comida_x = round(random.randrange(0, largura - tamanho_bloco) / tamanho_bloco) * tamanho_bloco
    comida_y = round(random.randrange(0, altura - tamanho_bloco) / tamanho_bloco) * tamanho_bloco

    while not game_over:

        while game_close:
            tela.fill(cor_fundo)
            mensagem("Você perdeu!", pygame.Color(255, 0, 0), [largura / 2 - 80, altura / 2 - 100])

            # Gerenciador de interface para a tela de game over
            gerenciador_ui_gameover = pygame_gui.UIManager((largura, altura))

            botao_menu = pygame_gui.elements.UIButton(relative_rect=pygame.Rect((largura/2 - 75, altura/2 - 40), (150, 50)),
                                                      text='Voltar ao Menu',
                                                      manager=gerenciador_ui_gameover)
            botao_sair = pygame_gui.elements.UIButton(relative_rect=pygame.Rect((largura/2 - 75, altura/2 + 20), (150, 50)),
                                                      text='Sair do Jogo',
                                                      manager=gerenciador_ui_gameover)

            game_over_screen = True
            while game_over_screen:
                tempo_delta = clock.tick(60)/1000.0
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        pygame.quit()
                        quit()
                    if event.type == pygame.USEREVENT:
                        if event.user_type == pygame_gui.UI_BUTTON_PRESSED:
                            if event.ui_element == botao_menu:
                                game_over_screen = False
                                game_close = False
                                gerenciador_ui_gameover.clear_and_reset()
                                menu()
                            if event.ui_element == botao_sair:
                                pygame.quit()
                                quit()
                    gerenciador_ui_gameover.process_events(event)

                gerenciador_ui_gameover.update(tempo_delta)
                tela.fill(cor_fundo)
                mensagem("Você perdeu!", pygame.Color(255, 0, 0), [largura / 2 - 80, altura / 2 - 100])
                sua_pontuacao(comprimento_cobra - 1)
                gerenciador_ui_gameover.draw_ui(tela)
                pygame.display.update()

            # Quebrar o loop após voltar ao menu ou sair
            break

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                game_over = True
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_LEFT and x1_mudanca != tamanho_bloco:
                    x1_mudanca = -tamanho_bloco
                    y1_mudanca = 0
                elif event.key == pygame.K_RIGHT and x1_mudanca != -tamanho_bloco:
                    x1_mudanca = tamanho_bloco
                    y1_mudanca = 0
                elif event.key == pygame.K_UP and y1_mudanca != tamanho_bloco:
                    y1_mudanca = -tamanho_bloco
                    x1_mudanca = 0
                elif event.key == pygame.K_DOWN and y1_mudanca != -tamanho_bloco:
                    y1_mudanca = tamanho_bloco
                    x1_mudanca = 0

        if x1 >= largura or x1 < 0 or y1 >= altura or y1 < 0:
            game_close = True

        x1 += x1_mudanca
        y1 += y1_mudanca
        tela.fill(cor_fundo)
        pygame.draw.rect(tela, pygame.Color(0, 255, 0), [comida_x, comida_y, tamanho_bloco, tamanho_bloco])
        cobra_cabeca = [x1, y1]
        lista_cobra.append(cobra_cabeca)
        if len(lista_cobra) > comprimento_cobra:
            del lista_cobra[0]

        for x in lista_cobra[:-1]:
            if x == cobra_cabeca:
                game_close = True

        nossa_cobra(tamanho_bloco, lista_cobra)
        sua_pontuacao(comprimento_cobra - 1)

        pygame.display.update()

        if x1 == comida_x and y1 == comida_y:
            comida_x = round(random.randrange(0, largura - tamanho_bloco) / tamanho_bloco) * tamanho_bloco
            comida_y = round(random.randrange(0, altura - tamanho_bloco) / tamanho_bloco) * tamanho_bloco
            comprimento_cobra += 1

        clock.tick(velocidade_cobra)

    pygame.quit()
    quit()

menu()