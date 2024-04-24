package br.fecap.informaes;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import java.text.DecimalFormat;

public class Financeiro extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_financeiro);

        EditText editSalario = findViewById(R.id.edit_FinancSal);

        TextView txtSalBruto = findViewById(R.id.txt_FinancBruto);
        TextView txtDescINSS = findViewById(R.id.txt_FinancINSS);
        TextView txtDescFGTS = findViewById(R.id.txt_FinancFGTS);
        TextView txtSalFinal = findViewById(R.id.txt_FinancFinal);

        Button btnLimpar = findViewById(R.id.btn_FinancLimpar);
        Button btnEncerrar = findViewById(R.id.btn_FinancEncerrar);

        DecimalFormat df = new DecimalFormat("#.##");

        editSalario.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {

            }

            @Override
            public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
                txtSalBruto.setText("Salario bruto: " + editSalario.getText().toString());
                if (!TextUtils.isEmpty(editSalario.getText().toString())) {
                    txtDescINSS.setText("Desconto INSS: " + df.format(calcularDescontoINSS(Double.parseDouble(editSalario.getText().toString()))));
                    txtDescFGTS.setText("Desconto FGTS: " + df.format(calcularDescontoFGTS(Double.parseDouble(editSalario.getText().toString()))));
                    txtSalFinal.setText("Salário final: " + (df.format((Double.parseDouble(editSalario.getText().toString())) - (calcularDescontoINSS(Double.parseDouble(editSalario.getText().toString())) + calcularDescontoFGTS(Double.parseDouble(editSalario.getText().toString()))))));
                } else {
                    txtDescINSS.setText("Desconto INSS: ");
                    txtDescFGTS.setText("Desconto FGTS: ");
                    txtSalFinal.setText("Salário final: ");
                }
            }

            @Override
            public void afterTextChanged(Editable editable) {

            }
        });

        btnLimpar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                editSalario.setText("");
            }
        });

        btnEncerrar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startActivity(new Intent(Financeiro.this, MainActivity.class));
            }
        });

    }

    public static double calcularDescontoINSS(double salarioBruto) {
        if(salarioBruto <= 1412){
            return salarioBruto * 0.075;
        } else if (salarioBruto > 1412 && salarioBruto <= 2666.68) {
            return (salarioBruto * 0.09) - 21.18;
        } else if (salarioBruto > 2666.68 && salarioBruto <= 4000.03) {
            return (salarioBruto * 0.12) - 101.18;
        } else if (salarioBruto > 4000.03 && salarioBruto <= 7786.02) {
        return (salarioBruto * 0.14) - 181.18;
        } else{
            return 908.86;
        }
    }

    public static double calcularDescontoFGTS(double salarioBruto){
        return salarioBruto * 0.08;
    }


}