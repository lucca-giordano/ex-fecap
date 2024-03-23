abstract class Veiculo implements IVenda{

    protected String modelo;
    protected int anoFabricacao;
    protected double preco;
    protected boolean disponivel;
    protected Pessoa proprietario;

    public Veiculo(String modelo, int anoFabricacao, double preco) {
        this.modelo = modelo;
        this.anoFabricacao = anoFabricacao;
        this.preco = preco;
        this.disponivel = true;
    }

    // Implementação do método vender
    public void vender() {
        if (disponivel) {
            disponivel = false;
            System.out.println("Veículo vendido: " + modelo);
        } else {
            System.out.println("Este veículo já foi vendido.");
        }
    }

    public void setProprietario(Pessoa proprietario) {
        this.proprietario = proprietario;
    }


}
