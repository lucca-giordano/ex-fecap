public class Main {
    public static void main(String[] args) {

        // Criando uma pessoa
        Pessoa pessoa = new Pessoa("João", 30, "123.456.789-00");

        // Criando um carro
        Carro carro = new Carro("Fiat Uno", 2015, 20000, 4);
        carro.setProprietario(pessoa);

        // Criando uma moto
        Moto moto = new Moto("Honda CG", 2020, 15000, 150);
        moto.setProprietario(pessoa);

        // Vendendo o carro e a moto
        carro.vender();
        moto.vender();
        System.out.println(moto.proprietario.nome + " comprou: " + moto.modelo);
        System.out.println("DETALHES DO VEICULO:\n"
                            +moto.modelo+"\n"
                            +moto.anoFabricacao+"\n"
                            +moto.cilindrada+"\n"
                            +"R$"+moto.preco);

    }
}

