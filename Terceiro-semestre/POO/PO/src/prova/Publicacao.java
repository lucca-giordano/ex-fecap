package prova;

public class Publicacao {
	
	private String titulo;
	private String dataPublicacao;

	public Publicacao(String titulo, String dataPublicacao) {
		super();
		this.titulo = titulo;
		this.dataPublicacao = dataPublicacao;
	}

	public String getTitulo() {
		return titulo;
	}

	public void setTitulo(String titulo) {
		this.titulo = titulo;
	}

	public String getDataPublicacao() {
		return dataPublicacao;
	}

	public void setDataPublicacao(String dataPublicacao) {
		this.dataPublicacao = dataPublicacao;
	}
	
	public void imprimir() {
		System.out.println("Impressão de publicação");
	}

}
