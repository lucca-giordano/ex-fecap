public class Moto extends Veiculo{

    public int cilindrada;

    public Moto(String modelo, int anoFabricacao, double preco, int cilindrada) {
        super(modelo, anoFabricacao, preco);
        this.cilindrada = cilindrada;
    }
}
