package br.edu.fecap.listview;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.ListView;

import java.lang.reflect.Array;

public class MainActivity extends AppCompatActivity {

    private ListView lvLocais;
    private String[] itens = {
            "Analise Desenvolvimento de Sistemas", "Gestão de TI",
            "Ciências da Computação", "Engenharia da computação",
            "Engenharia Eletrônca", "Ciencia de dados",
            "Sistema de informação", "Jogos Digitais",
            "Rede de computadores", "Segurança da informação",
            "Internet das coisas"
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        lvLocais = findViewById(R.id.lv_Locais);

        //Adaptador para a lista
        ArrayAdapter<String> adaptador = new ArrayAdapter<String>(
                getApplicationContext(),
                android.R.layout.simple_expandable_list_item_1,
                android.R.id.text1,
                itens
        );

        //Adcionar adaptador para a Lista
        lvLocais.setAdapter(adaptador);

    }
}