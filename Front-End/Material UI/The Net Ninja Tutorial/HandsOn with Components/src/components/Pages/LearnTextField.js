import TextField from '@mui/material/TextField';

export default function LearnTextField () {
	return (
		<div>

			{/*===============  Text Field COMPONENT =================

				[Ref Site]: https://mui.com/components/text-fields/#main-content

				<TextField id="outlined-basic" label="Outlined Text Field" variant="outlined" />

				<TextField
		          id="outlined-password-input"
		          label="Password"
		          type="password"
		          autoComplete="current-password"
		        />
			*/}

			<h1>Form Example</h1>

			<form noValidate autoComplete="off"> 

				<TextField 
					id="outlined-basic" 
					label="Outlined Text Field" 
					variant="outlined" 
					color="secondary"
					fullWidth
					required
				/>
				<br />
				<br />
				<TextField
		          id="outlined-number"
		          label="Number"
		          type="number"
		          InputLabelProps={{
		            shrink: true,
		          }}
		          fullWidth
		        />
			</form>
		</div>
	)
}