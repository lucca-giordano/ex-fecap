package prova;

public class Main {
	public static void main(String[] args) {
		
		// Construindo o objeto livro
		Livro livro = new Livro("O senhor dos anéis", "20/12/1998", "Editora abril");
		
		//Testando os getters do livro
		System.out.println("\n-----------------Livro-----------------");
		System.out.println("----------------Getters----------------");
		
		System.out.println("Titulo livro: " + livro.getTitulo());
		System.out.println("Data de lançamento livro: " + livro.getDataPublicacao());
		System.out.println("Editora livro: " + livro.getEditora());
		
		System.out.println("\n--------------Setters----------------");
		
		//Testando os Setters do livro
		
		livro.setTitulo("Harry Potter");
		livro.setDataPublicacao("06/06/2024");
		livro.setEditora("Editora X");
		
		System.out.println("Novo titulo livro: " + livro.getTitulo());
		System.out.println("Nova data de lançamento livro: " + livro.getDataPublicacao());
		System.out.println("Nova editora livro: " + livro.getEditora());
		
		System.out.println("\n----------------Revista----------------");
		
		// Construindo o objeto revista
		Revista revista = new Revista("Greve dos onibus", "06/06/2024", "João Gomes", "São Paulo");
		
		//Testando os getters da revista
		
		System.out.println("----------------Getters----------------");
		
		System.out.println("Titulo revista: " + revista.getTitulo());
		System.out.println("Data de publicação revista: " + revista.getDataPublicacao());
		System.out.println("Editor revista: " + revista.getEditor());
		System.out.println("Local revista: " + revista.getLocal());
		
		System.out.println("\n----------------Setters----------------");
		
		//Testando os Setters da revista
		
		revista.setTitulo("Greve cancelada!");
		revista.setDataPublicacao("06/06/2024");
		revista.setEditor("João Gomes");
		revista.setLocal("São Paulo");
		
		System.out.println("Titulo revista: " + revista.getTitulo());
		System.out.println("Data de publicação revista: " + revista.getDataPublicacao());
		System.out.println("Editor revista: " + revista.getEditor());
		System.out.println("Local revista: " + revista.getLocal());
		
		

	}

}
