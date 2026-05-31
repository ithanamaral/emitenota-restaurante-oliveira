.PHONY: build start install

# Target padrão (rodado ao executar apenas 'make' ou 'make build')
build:
	npm run dist

# Para iniciar o projeto em modo de desenvolvimento
start:
	npm start

# Para instalar as dependências do projeto
install:
	npm install
